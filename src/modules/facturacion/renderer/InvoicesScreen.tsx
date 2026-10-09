import { FileSpreadsheet } from "lucide-react";
import { useState, type FormEvent } from "react";
import { APP } from "@shared/api";
import { CURRENCIES, type CurrencyCode } from "@shared/money";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { Empty, ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { formatDateTime, formatMoney } from "../../../renderer/src/lib/format";
import { call, messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { formatTaxRate } from "../../impuestos/api";
import type { Sale } from "../../ventas/api";
import { ventas } from "../../ventas/renderer/client";
import { SaleDialog } from "../../ventas/renderer/SaleDialog";
import { CONTROL_MAX, formatInvoiceDate, VOID_REASON_MAX, type BookRow } from "../api";
import { facturacion } from "./client";
import { t } from "./texts";

/** Moneda local en la que se expresa el auxiliar del libro. */
const LOCAL: CurrencyCode = "VES";

const pad = (value: number) => String(value).padStart(2, "0");
const thisMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
};

/** Las facturas de un mes, con sus montos en bolívares: un auxiliar para armar el Libro de Ventas. */
export function InvoicesScreen() {
  const { settings } = useApp();
  const [month, setMonth] = useState(thisMonth);
  const book = useData(() => facturacion.list(month), [month]);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [voiding, setVoiding] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const rows = book.data?.rows ?? [];
  const totals = book.data?.totals;
  const rates = totals?.taxes.map((tax) => tax.rate) ?? [];
  const show = (amount: number) => formatMoney(amount, LOCAL);
  // La columna de exento solo ocupa sitio si el mes tiene algo exento.
  const withExempt = (totals?.exempt ?? 0) > 0;
  const taxOf = (row: Pick<BookRow, "taxes">, rate: number) => row.taxes.find((tax) => tax.rate === rate);

  async function view(saleId: string) {
    setError(null);
    try {
      setViewing(await ventas.get(saleId));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function exportBook() {
    await once(async () => {
      setError(null);
      try {
        setExported(await facturacion.exportBook(month));
      } catch (reason) {
        setError(messageOf(reason));
      }
    });
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <h1 className="page-title">{t("screen.title")}</h1>
        <div className="page-actions">
          {settings["invoice.mode"] === "forma-libre" && (
            <button type="button" className="btn" onClick={() => setVoiding(true)}>
              {t("sheet.action")}
            </button>
          )}
          <button type="button" className="btn" disabled={rows.length === 0} onClick={() => void exportBook()}>
            <FileSpreadsheet size={20} strokeWidth={1.75} aria-hidden="true" />
            {t("screen.export")}
          </button>
        </div>
      </header>
      <p className="page-lead">{t("screen.lead")}</p>

      <div className="invoices-month">
        <Field label={t("screen.month")}>
          {(props) => <input {...props} className="input num" type="month" value={month} onChange={(event) => event.target.value && setMonth(event.target.value)} />}
        </Field>
      </div>

      <ErrorNote>{book.error ?? error}</ErrorNote>
      {exported && (
        <p className="note note--info">
          {t("screen.exported", { file: exported })}{" "}
          <button type="button" className="link" onClick={() => void call<void>(APP.showFile, exported)}>
            {t("box.show")}
          </button>
        </p>
      )}

      {book.data && rows.length === 0 && (
        <div className="card">
          <Empty title={t("screen.empty.title")}>{t("screen.empty.body")}</Empty>
        </div>
      )}

      {rows.length > 0 && totals && (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>{t("col.date")}</th>
                <th>{t("col.number")}</th>
                <th>{t("col.customer")}</th>
                {withExempt && <th className="right">{t("col.exempt")}</th>}
                {rates.map((rate) => (
                  <th className="right" key={rate}>
                    {t("col.base")} {formatTaxRate(rate)}
                  </th>
                ))}
                {rates.map((rate) => (
                  <th className="right" key={rate}>
                    {t("col.tax")} {formatTaxRate(rate)}
                  </th>
                ))}
                <th className="right">
                  {t("col.total")} ({CURRENCIES[LOCAL].symbol})
                </th>
                <th>{t("col.status")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.invoiceId} className="is-clickable" onClick={() => void view(row.saleId)}>
                  <td className="num">{formatInvoiceDate(row.issuedOn)}</td>
                  <td>
                    <button
                      type="button"
                      className="row-btn num invoices-number"
                      aria-label={t("open", { number: row.number })}
                      onClick={(event) => (event.stopPropagation(), void view(row.saleId))}
                    >
                      {row.number}
                    </button>
                    {row.control && <span className="invoices-sub muted num">{t("box.control", { control: row.control })}</span>}
                  </td>
                  <td>
                    {row.customerName}
                    {row.customerDoc && <span className="invoices-sub muted num">{row.customerDoc}</span>}
                  </td>
                  {withExempt && <td className="right num">{row.voided ? "—" : show(row.exempt)}</td>}
                  {rates.map((rate) => (
                    <td className="right num" key={rate}>
                      {row.voided ? "—" : show(taxOf(row, rate)?.base ?? 0)}
                    </td>
                  ))}
                  {rates.map((rate) => (
                    <td className="right num" key={rate}>
                      {row.voided ? "—" : show(taxOf(row, rate)?.tax ?? 0)}
                    </td>
                  ))}
                  <td className="right num">{row.voided ? "—" : show(row.total)}</td>
                  <td>
                    {row.voided ? (
                      <span className="badge badge--warn">{t("status.void")}</span>
                    ) : row.kind === "externa" ? (
                      <span className="badge">{t("status.external")}</span>
                    ) : (
                      <span className="badge badge--accent">{t("status.issued")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="invoices-totals">
                <th colSpan={3}>{t("totals")}</th>
                {withExempt && <td className="right num">{show(totals.exempt)}</td>}
                {rates.map((rate) => (
                  <td className="right num" key={rate}>
                    {show(taxOf(totals, rate)?.base ?? 0)}
                  </td>
                ))}
                {rates.map((rate) => (
                  <td className="right num" key={rate}>
                    {show(taxOf(totals, rate)?.tax ?? 0)}
                  </td>
                ))}
                <td className="right num">{show(totals.total)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {book.data && book.data.voidedSheets.length > 0 && (
        <section className="section">
          <h2 className="section-title">{t("sheets.title")}</h2>
          <ul className="invoices-sheets">
            {book.data.voidedSheets.map((sheet) => (
              <li key={sheet.control}>
                <span className="num">{sheet.control}</span> · {sheet.reason} <span className="muted num">· {formatDateTime(sheet.at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {viewing && (
        <SaleDialog
          sale={viewing}
          fresh={false}
          onClose={() => {
            setViewing(null);
            void book.reload();
          }}
        />
      )}
      {voiding && (
        <VoidSheetDialog
          onClose={() => setVoiding(false)}
          onVoided={() => {
            setVoiding(false);
            void book.reload();
          }}
        />
      )}
    </div>
  );
}

function VoidSheetDialog({ onClose, onVoided }: { onClose(): void; onVoided(): void }) {
  const status = useData(() => facturacion.status(), []);
  const [control, setControl] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (control.trim() === "" || reason.trim() === "") return;
    await once(async () => {
      try {
        await facturacion.voidSheet(control, reason);
        onVoided();
      } catch (failure) {
        setError(messageOf(failure));
      }
    });
  }

  return (
    <Dialog
      title={t("sheet.title")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="sheet-form" className="btn btn--danger">
            {t("sheet.confirm")}
          </button>
        </>
      }
    >
      <form id="sheet-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted">{t("sheet.lead")}</p>
        <Field label={t("sheet.control")} error={touched && control.trim() === "" ? t("issue.required.control") : null}>
          {(props) => (
            <input
              {...props}
              className="input num"
              value={control}
              maxLength={CONTROL_MAX}
              placeholder={status.data?.nextControl ?? ""}
              autoComplete="off"
              spellCheck={false}
              data-autofocus=""
              onChange={(event) => setControl(event.target.value)}
            />
          )}
        </Field>
        <Field label={t("void.reason")} error={touched && reason.trim() === "" ? t("void.reason.required") : null}>
          {(props) => (
            <input {...props} className="input" value={reason} maxLength={VOID_REASON_MAX} autoComplete="off" onChange={(event) => setReason(event.target.value)} />
          )}
        </Field>
        <ErrorNote>{error ?? status.error}</ErrorNote>
      </form>
    </Dialog>
  );
}
