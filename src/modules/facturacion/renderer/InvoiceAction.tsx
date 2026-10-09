import { FileText } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { APP } from "@shared/api";
import { hasValidCheck, parseTaxId } from "@shared/taxid";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { usePrint } from "../../../renderer/src/components/Print";
import { call, messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { CUSTOMER_ADDRESS_MAX, CUSTOMER_DOC_MAX, CUSTOMER_NAME_MAX, CUSTOMER_PHONE_MAX } from "../../clientes/api";
import { clientes } from "../../clientes/renderer/client";
import type { Sale } from "../../ventas/api";
import type { SaleSlotProps } from "../../ventas/renderer/SaleDialog";
import { CONTROL_MAX, formatInvoiceDate, INVOICE_NUMBER_MAX, VOID_REASON_MAX, type Invoice } from "../api";
import { facturacion } from "./client";
import { InvoiceDocument } from "./InvoiceDocument";
import { t } from "./texts";

/** Líneas que caben con holgura en una sola hoja, según el papel. */
const LINES_PER_SHEET = { carta: 28, "media-carta": 8 } as const;

/**
 * Lo que la facturación añade a la ventana de una venta: su factura, si la tiene, o el
 * botón para emitirla (en forma libre) o anotarla (si se emitió por otro medio).
 */
export function InvoiceAction({ sale }: SaleSlotProps) {
  const { settings } = useApp();
  const mode = settings["invoice.mode"];
  const printer = usePrint();
  const invoice = useData<Invoice | null>(() => (mode === "off" ? Promise.resolve(null) : facturacion.ofSale(sale.id)), [sale.id, mode]);
  const [dialog, setDialog] = useState<"issue" | "record" | "void" | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const once = useOnce();

  if (mode === "off" || invoice.data === undefined) return null;
  const current = invoice.data;
  const paper = settings["invoice.paper"];

  const document = (which: Invoice, copy: boolean) => (
    <InvoiceDocument invoice={which} sale={sale} top={settings["invoice.top"]} header={settings["invoice.header"]} copy={copy} />
  );

  async function run(action: () => Promise<string | void>) {
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        const file = await action();
        if (typeof file === "string") setSaved(file);
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <section className="invoice-box" aria-label={t("box.title")}>
      {current ? (
        <>
          <p className="invoice-box-text">
            <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>
              <strong className="num">{t("box.issued", { number: current.number })}</strong>
              <span className="muted num">
                {current.control && ` · ${t("box.control", { control: current.control })}`} · {formatInvoiceDate(current.issuedOn)}
                {current.kind === "externa" && ` · ${t("box.external")}`}
              </span>
            </span>
          </p>
          <div className="row">
            {current.kind === "emitida" && (
              <>
                <button type="button" className="btn" disabled={busy} onClick={() => void run(() => printer.print(document(current, false), paper))}>
                  {t("box.print")}
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={busy}
                  onClick={() => void run(() => printer.savePdf(document(current, true), paper, `factura-${current.number}`))}
                >
                  {t("box.pdf")}
                </button>
              </>
            )}
            <button type="button" className="btn btn--quiet" disabled={busy} onClick={() => setDialog("void")}>
              {t("box.void")}
            </button>
          </div>
        </>
      ) : (
        <div>
          <button type="button" className="btn" onClick={() => setDialog(mode === "forma-libre" ? "issue" : "record")}>
            <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
            {mode === "forma-libre" ? t("box.issue") : t("box.record")}
          </button>
        </div>
      )}

      <ErrorNote>{error ?? invoice.error}</ErrorNote>
      {saved && (
        <p className="note note--info">
          {t("box.saved", { file: saved })}{" "}
          <button type="button" className="link" onClick={() => void call<void>(APP.showFile, saved)}>
            {t("box.show")}
          </button>
        </p>
      )}

      {dialog === "issue" && (
        <IssueDialog
          sale={sale}
          longAfter={LINES_PER_SHEET[paper]}
          onClose={() => setDialog(null)}
          onIssued={(issued) => {
            // Emitir y imprimir van aparte: antes de imprimir se comprueba la hoja que está en la impresora.
            invoice.set(issued);
            setDialog(null);
          }}
        />
      )}
      {dialog === "record" && (
        <RecordDialog
          sale={sale}
          onClose={() => setDialog(null)}
          onRecorded={(recorded) => {
            invoice.set(recorded);
            setDialog(null);
          }}
        />
      )}
      {dialog === "void" && current && (
        <VoidDialog
          invoice={current}
          onClose={() => setDialog(null)}
          onVoided={() => {
            invoice.set(null);
            setSaved(null);
            setDialog(null);
          }}
        />
      )}
    </section>
  );
}

/* ---------- emitir ---------- */

function IssueDialog({ sale, longAfter, onClose, onIssued }: { sale: Sale; longAfter: number; onClose(): void; onIssued(invoice: Invoice): void }) {
  const status = useData(() => facturacion.status(), []);
  const [name, setName] = useState(sale.customer?.name ?? "");
  const [doc, setDoc] = useState(sale.customer?.doc ?? "");
  const [address, setAddress] = useState("");
  const [phone, setPhone] = useState("");
  const [control, setControl] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  // La dirección y el teléfono salen de la ficha del cliente, si la venta lo lleva.
  const customerId = sale.customer?.id;
  useEffect(() => {
    if (!customerId) return;
    let alive = true;
    clientes
      .get(customerId)
      .then((customer) => {
        if (!alive) return;
        setAddress((current) => current || customer.address);
        setPhone((current) => current || customer.phone);
        setDoc((current) => current || customer.doc);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [customerId]);

  // El número de control que toca, hasta que la persona escriba otro.
  const next = status.data?.nextControl ?? "";
  useEffect(() => {
    setControl((current) => current || next);
  }, [next]);

  const missing = status.data?.missing ?? [];
  const taxId = parseTaxId(doc);
  const badCheck = taxId !== null && !hasValidCheck(taxId);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (missing.length > 0 || name.trim() === "" || doc.trim() === "" || control.trim() === "") return;
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        onIssued(await facturacion.issue({ saleId: sale.id, customer: { name, doc, address, phone }, control }));
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  return (
    <Dialog
      title={t("issue.title")}
      size="lg"
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="issue-form" className="btn btn--primary" disabled={busy || !status.data || missing.length > 0}>
            {t("issue.confirm")}
          </button>
        </>
      }
    >
      <form id="issue-form" className="stack" onSubmit={submit} noValidate>
        {missing.length > 0 && <p className="note note--error">{t("issue.missing", { what: missing.join("; ") })}</p>}
        {status.data && missing.length === 0 && <p className="muted num">{t("issue.number", { number: status.data.nextNumber })}</p>}
        {sale.lines.length > longAfter && <p className="note note--warn">{t("issue.long", { count: sale.lines.length })}</p>}

        <h3 className="subsection-title">{t("issue.customer")}</h3>
        <div className="form-grid">
          <Field label={t("issue.name")} error={touched && name.trim() === "" ? t("issue.required.name") : null}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={name}
                maxLength={CUSTOMER_NAME_MAX}
                autoComplete="off"
                data-autofocus=""
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field
            label={t("issue.doc")}
            error={touched && doc.trim() === "" ? t("issue.required.doc") : null}
            hint={badCheck ? <span className="field-warning">{t("issue.doc.check")}</span> : undefined}
          >
            {(props) => (
              <input
                {...props}
                className="input"
                value={doc}
                maxLength={CUSTOMER_DOC_MAX}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setDoc(event.target.value)}
                onBlur={() => taxId && setDoc(taxId.text)}
              />
            )}
          </Field>
        </div>
        <div className="form-grid">
          <Field label={t("issue.address")}>
            {(props) => (
              <input {...props} className="input" value={address} maxLength={CUSTOMER_ADDRESS_MAX} autoComplete="off" onChange={(event) => setAddress(event.target.value)} />
            )}
          </Field>
          <Field label={t("issue.phone")}>
            {(props) => (
              <input {...props} className="input" value={phone} maxLength={CUSTOMER_PHONE_MAX} autoComplete="off" onChange={(event) => setPhone(event.target.value)} />
            )}
          </Field>
        </div>

        <div className="invoice-control">
          <Field label={t("issue.control")} hint={t("issue.control.hint")} error={touched && control.trim() === "" ? t("issue.required.control") : null}>
            {(props) => (
              <input
                {...props}
                className="input num"
                value={control}
                maxLength={CONTROL_MAX}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setControl(event.target.value)}
              />
            )}
          </Field>
        </div>
        <p className="field-hint">{t("issue.final")}</p>
        <ErrorNote>{error ?? status.error}</ErrorNote>
      </form>
    </Dialog>
  );
}

/* ---------- anotar una factura de otro medio ---------- */

const pad = (value: number) => String(value).padStart(2, "0");
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

function RecordDialog({ sale, onClose, onRecorded }: { sale: Sale; onClose(): void; onRecorded(invoice: Invoice): void }) {
  const [number, setNumber] = useState("");
  const [control, setControl] = useState("");
  const [issuedOn, setIssuedOn] = useState(today);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (number.trim() === "") return;
    await once(async () => {
      try {
        onRecorded(await facturacion.record({ saleId: sale.id, number, control, issuedOn }));
      } catch (reason) {
        setError(messageOf(reason));
      }
    });
  }

  return (
    <Dialog
      title={t("record.title")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="record-form" className="btn btn--primary">
            {t("record.confirm")}
          </button>
        </>
      }
    >
      <form id="record-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted">{t("record.lead")}</p>
        <div className="form-grid">
          <Field label={t("record.number")} error={touched && number.trim() === "" ? t("record.required") : null}>
            {(props) => (
              <input
                {...props}
                className="input num"
                value={number}
                maxLength={INVOICE_NUMBER_MAX}
                autoComplete="off"
                spellCheck={false}
                data-autofocus=""
                onChange={(event) => setNumber(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("record.date")}>
            {(props) => <input {...props} className="input num" type="date" value={issuedOn} onChange={(event) => setIssuedOn(event.target.value)} />}
          </Field>
        </div>
        <Field label={t("record.control")}>
          {(props) => (
            <input
              {...props}
              className="input num"
              value={control}
              maxLength={CONTROL_MAX}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => setControl(event.target.value)}
            />
          )}
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}

/* ---------- anular ---------- */

function VoidDialog({ invoice, onClose, onVoided }: { invoice: Invoice; onClose(): void; onVoided(): void }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (reason.trim() === "") return;
    await once(async () => {
      try {
        await facturacion.void(invoice.id, reason);
        onVoided();
      } catch (failure) {
        setError(messageOf(failure));
      }
    });
  }

  return (
    <Dialog
      title={t("void.title", { number: invoice.number })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" data-autofocus="" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="void-form" className="btn btn--danger">
            {t("void.confirm")}
          </button>
        </>
      }
    >
      <form id="void-form" className="stack" onSubmit={submit} noValidate>
        <p>{invoice.kind === "emitida" ? t("void.body") : t("void.body.externa")}</p>
        <Field label={t("void.reason")} error={touched && reason.trim() === "" ? t("void.reason.required") : null}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={reason}
              maxLength={VOID_REASON_MAX}
              placeholder={t("void.reason.placeholder")}
              autoComplete="off"
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}
