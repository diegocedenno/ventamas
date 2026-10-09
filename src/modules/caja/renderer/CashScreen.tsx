import { ArrowDownUp, Banknote, Lock, Printer } from "lucide-react";
import { useState, type FormEvent } from "react";
import { parseAmount } from "@shared/money";
import { Chip } from "../../../renderer/src/components/Choices";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { AmountInput, ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { formatDateTime, formatMoney, plainAmount } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import { NOTE_MAX, REASON_MAX, type PaymentMethod, type SessionSummary } from "../api";
import { BILLS, countTotal } from "../denominations";
import { caja } from "./client";
import { CloseReport } from "./CloseReport";
import { t } from "./texts";

export function CashScreen() {
  const session = useData(() => caja.current(), []);
  const history = useData(() => caja.history(), []);
  const [report, setReport] = useState<SessionSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function view(id: string) {
    setError(null);
    try {
      setReport(await caja.summary(id));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  const closed = history.data?.filter((item) => item.closedAt !== null) ?? [];

  return (
    <div className="page page--wide">
      <header>
        <h1 className="page-title">{t("title")}</h1>
      </header>

      <ErrorNote>{session.error ?? error}</ErrorNote>

      {session.data === null && <OpenForm onOpened={(summary) => session.set(summary)} />}
      {session.data && (
        <OpenSession
          summary={session.data}
          onChanged={(summary) => session.set(summary)}
          onClosed={(summary) => {
            session.set(null);
            setReport(summary);
            void history.reload();
          }}
        />
      )}

      <section className="section">
        <h2 className="section-title">{t("history")}</h2>
        {history.data && closed.length === 0 && <p className="muted">{t("history.empty")}</p>}
        {closed.length > 0 && (
          <div className="table-wrap">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>{t("report.opened")}</th>
                  <th>{t("report.closed")}</th>
                  <th className="right">{t("stat.sales")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {closed.map((item) => (
                  <tr key={item.id}>
                    <td>{formatDateTime(item.openedAt)}</td>
                    <td>{item.closedAt ? formatDateTime(item.closedAt) : t("history.open")}</td>
                    <td className="right num">{item.salesCount}</td>
                    <td className="right">
                      <button type="button" className="link" onClick={() => void view(item.id)}>
                        {t("history.view")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {report && <CloseReport summary={report} onClose={() => setReport(null)} />}
    </div>
  );
}

/* ---------- caja cerrada: abrir ---------- */

function OpenForm({ onOpened }: { onOpened(summary: SessionSummary): void }) {
  const methods = useData(() => caja.methods(), []);
  const cash = (methods.data ?? []).filter((method) => method.active && method.kind === "efectivo");
  const [values, setValues] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const parsed = cash.map((method) => {
    const text = (values[method.id] ?? "").trim();
    return { method, amount: text === "" ? 0 : (parseAmount(text, method.currency)?.amount ?? null) };
  });
  const invalid = parsed.some((item) => item.amount === null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        onOpened(await caja.open({ floats: parsed.map(({ method, amount }) => ({ methodId: method.id, amount: amount ?? 0 })) }));
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  return (
    <section className="card notice">
      <Lock className="notice-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
      <form className="cash-open" onSubmit={submit} noValidate>
        <div>
          <h2 className="notice-title">{t("closed.title")}</h2>
          <p className="notice-body">{t("closed.lead")}</p>
        </div>
        <fieldset className="cash-floats">
          <legend className="field-label">{t("open.float")}</legend>
          <p className="field-hint">{t("open.float.hint")}</p>
          <div className="form-grid">
            {cash.map((method, index) => (
              <Field key={method.id} label={method.name}>
                {(props) => (
                  <AmountInput
                    {...props}
                    currency={method.currency}
                    value={values[method.id] ?? ""}
                    placeholder="0,00"
                    autoFocus={index === 0}
                    onChange={(value) => setValues((current) => ({ ...current, [method.id]: value }))}
                  />
                )}
              </Field>
            ))}
          </div>
        </fieldset>
        {touched && invalid && <p className="field-error">{t("open.invalid")}</p>}
        <ErrorNote>{error ?? methods.error}</ErrorNote>
        <div>
          <button type="submit" className="btn btn--primary" disabled={busy || !methods.data}>
            {t("open.action")}
          </button>
        </div>
      </form>
    </section>
  );
}

/* ---------- caja abierta ---------- */

interface OpenSessionProps {
  summary: SessionSummary;
  onChanged(summary: SessionSummary): void;
  onClosed(summary: SessionSummary): void;
}

function OpenSession({ summary, onChanged, onClosed }: OpenSessionProps) {
  const [dialog, setDialog] = useState<"move" | "close" | "cut" | null>(null);
  const lines = summary.totals.filter((line) => line.method.active || line.expected !== 0);
  const cash = lines.filter((line) => line.method.kind === "efectivo" && line.method.active).map((line) => line.method);

  return (
    <>
      <p className="muted">{t("opened.since", { when: formatDateTime(summary.openedAt) })}</p>

      <div className="stats">
        <div className="stat">
          <span className="stat-label">{t("stat.sales")}</span>
          <span className="stat-value num">{summary.salesCount}</span>
        </div>
        <div className="stat">
          <span className="stat-label">{t("stat.total")}</span>
          <span className="stat-value num">
            {summary.salesTotals.length ? summary.salesTotals.map((total) => formatMoney(total.amount, total.currency)).join(" · ") : "—"}
          </span>
        </div>
      </div>

      <section className="section">
        <div className="page-head">
          <h2 className="section-title">{t("by.method")}</h2>
          <div className="page-actions">
            <button type="button" className="btn" onClick={() => setDialog("move")}>
              <ArrowDownUp size={20} strokeWidth={1.75} aria-hidden="true" />
              {t("move.action")}
            </button>
            <button type="button" className="btn" onClick={() => setDialog("cut")}>
              <Printer size={20} strokeWidth={1.75} aria-hidden="true" />
              {t("cut.action")}
            </button>
            <button type="button" className="btn btn--primary" onClick={() => setDialog("close")}>
              {t("close.action")}
            </button>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>{t("col.method")}</th>
                <th className="right">{t("col.opening")}</th>
                <th className="right">{t("col.sales")}</th>
                <th className="right">{t("col.change")}</th>
                <th className="right">{t("col.moves")}</th>
                <th className="right">{t("col.expected")}</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const show = (amount: number) => (amount === 0 ? <span className="muted">—</span> : formatMoney(amount, line.method.currency));
                return (
                  <tr key={line.method.id}>
                    <td>{line.method.name}</td>
                    <td className="right num">{show(line.opening)}</td>
                    <td className="right num">{show(line.sales)}</td>
                    <td className="right num">{show(-line.change)}</td>
                    <td className="right num">{show(line.moves)}</td>
                    <td className="right num cash-expected">{formatMoney(line.expected, line.method.currency)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {dialog === "move" && (
        <MoveDialog
          methods={cash}
          onClose={() => setDialog(null)}
          onSaved={(next) => {
            onChanged(next);
            setDialog(null);
          }}
        />
      )}
      {/* Con la caja abierta, el informe es un corte: lo que lleva hasta ahora, sin cerrarla. */}
      {dialog === "cut" && <CloseReport summary={summary} onClose={() => setDialog(null)} />}
      {dialog === "close" && (
        <CloseDialog
          summary={summary}
          onClose={() => setDialog(null)}
          onClosed={(next) => {
            setDialog(null);
            onClosed(next);
          }}
        />
      )}
    </>
  );
}

/* ---------- entrada o salida de efectivo ---------- */

function MoveDialog({ methods, onClose, onSaved }: { methods: PaymentMethod[]; onClose(): void; onSaved(s: SessionSummary): void }) {
  const [kind, setKind] = useState<"salida" | "entrada">("salida");
  const [methodId, setMethodId] = useState(methods[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const method = methods.find((m) => m.id === methodId) ?? methods[0];
  const value = method ? parseAmount(amount, method.currency) : null;
  const amountInvalid = value === null || value.amount <= 0;
  // Los motivos de siempre, a un toque; cualquier otro se escribe.
  const quick =
    kind === "salida"
      ? [t("move.reason.out.1"), t("move.reason.out.2"), t("move.reason.out.3"), t("move.reason.out.4")]
      : [t("move.reason.in.1"), t("move.reason.in.2"), t("move.reason.in.3")];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!method || amountInvalid || reason.trim() === "") return;
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        onSaved(await caja.move({ methodId: method.id, kind, amount: value.amount, reason }));
      } catch (reason_) {
        setError(messageOf(reason_));
        setBusy(false);
      }
    });
  }

  return (
    <Dialog
      title={t("move.title")}
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="move-form" className="btn btn--primary" disabled={busy}>
            {t("move.save")}
          </button>
        </>
      }
    >
      <form id="move-form" className="cash-form" onSubmit={submit} noValidate>
        <fieldset className="choice">
          <legend className="field-label">{t("move.kind")}</legend>
          <div className="choice-options">
            {(["salida", "entrada"] as const).map((option) => (
              <label key={option} className="choice-option">
                <input type="radio" name="kind" className="sr-only" checked={kind === option} onChange={() => setKind(option)} />
                <span>{option === "salida" ? t("move.out") : t("move.in")}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="form-grid">
          <Field label={t("move.method")}>
            {(props) => (
              <select {...props} className="input select" value={method?.id ?? ""} onChange={(event) => setMethodId(event.target.value)}>
                {methods.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label={t("move.amount")} error={touched && amountInvalid ? t("move.amount.invalid") : null}>
            {(props) => <AmountInput {...props} currency={method?.currency ?? "USD"} value={amount} onChange={setAmount} data-autofocus="" />}
          </Field>
        </div>
        <Field label={t("move.reason")} error={touched && reason.trim() === "" ? t("move.reason.required") : null}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={reason}
              maxLength={REASON_MAX}
              placeholder={t("move.reason.placeholder")}
              autoComplete="off"
              onChange={(event) => setReason(event.target.value)}
            />
          )}
        </Field>
        <div className="chips" role="group" aria-label={t("move.reason.quick")}>
          {quick.map((text) => (
            <Chip key={text} pressed={reason === text} onClick={() => setReason(text)}>
              {text}
            </Chip>
          ))}
        </div>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}

/* ---------- cerrar caja ---------- */

function CloseDialog({ summary, onClose, onClosed }: { summary: SessionSummary; onClose(): void; onClosed(s: SessionSummary): void }) {
  // Se cuentan los medios activos y cualquiera que haya tenido movimiento.
  const lines = summary.totals.filter((line) => line.method.active || line.expected !== 0);
  const blind = useApp().settings["cash.blind"];
  const [values, setValues] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counting, setCounting] = useState<PaymentMethod | null>(null);
  const once = useOnce();

  const parsed = lines.map((line) => {
    const text = (values[line.method.id] ?? "").trim();
    const counted = text === "" ? null : (parseAmount(text, line.method.currency)?.amount ?? NaN);
    return { line, counted };
  });
  // Lo que tuvo movimiento hay que contarlo; lo demás puede quedar en blanco. A ciegas se
  // cuenta todo: decir qué se puede dejar en blanco sería decir dónde no hubo movimiento.
  const mustCount = (expected: number) => blind || expected !== 0;
  const invalid = parsed.some(({ line, counted }) => Number.isNaN(counted) || (counted === null && mustCount(line.expected)));

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        const counts = parsed
          .filter((item): item is typeof item & { counted: number } => item.counted !== null)
          .map(({ line, counted }) => ({ methodId: line.method.id, counted }));
        onClosed(await caja.close({ counts, note }));
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  return (
    <Dialog
      title={t("close.title")}
      size="lg"
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="close-form" className="btn btn--primary" disabled={busy}>
            {t("close.confirm")}
          </button>
        </>
      }
    >
      <form id="close-form" className="cash-form" onSubmit={submit} noValidate>
        <p className="muted">{blind ? t("close.lead.blind") : t("close.lead")}</p>
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>{t("col.method")}</th>
                {!blind && <th className="right">{t("col.expected")}</th>}
                <th className="right">{t("col.counted")}</th>
                {!blind && <th>{t("col.difference")}</th>}
              </tr>
            </thead>
            <tbody>
              {parsed.map(({ line, counted }, index) => {
                const { method } = line;
                const missing = touched && (Number.isNaN(counted) || (counted === null && mustCount(line.expected)));
                return (
                  <tr key={method.id}>
                    <td>{method.name}</td>
                    {!blind && <td className="right num">{formatMoney(line.expected, method.currency)}</td>}
                    <td className="cash-count">
                      <span className="cash-count-row">
                        <AmountInput
                          currency={method.currency}
                          aria-label={t("close.counted.label", { method: method.name })}
                          aria-invalid={missing ? true : undefined}
                          value={values[method.id] ?? ""}
                          autoFocus={index === 0}
                          onChange={(value) => setValues((current) => ({ ...current, [method.id]: value }))}
                        />
                        {method.kind === "efectivo" && (
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("close.bills.label", { method: method.name })}
                            title={t("close.bills")}
                            onClick={() => setCounting(method)}
                          >
                            <Banknote size={20} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        )}
                      </span>
                    </td>
                    {!blind && (
                      <td>
                        {counted === null || Number.isNaN(counted) ? (
                          <span className="muted">—</span>
                        ) : counted === line.expected ? (
                          <span className="badge badge--accent">{t("close.match")}</span>
                        ) : (
                          <span className="badge badge--warn num">
                            {counted > line.expected ? t("close.over") : t("close.short")}{" "}
                            {formatMoney(Math.abs(counted - line.expected), method.currency)}
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {touched && invalid && <p className="field-error">{blind ? t("close.invalid.blind") : t("close.invalid")}</p>}
        <Field label={t("close.note")}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={note}
              maxLength={NOTE_MAX}
              placeholder={t("close.note.placeholder")}
              autoComplete="off"
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
        <ErrorNote>{error}</ErrorNote>
      </form>
      {counting && (
        <BillCounter
          method={counting}
          onApply={(total) => {
            setValues((current) => ({ ...current, [counting.id]: plainAmount(total, counting.currency) }));
            setCounting(null);
          }}
          onClose={() => setCounting(null)}
        />
      )}
    </Dialog>
  );
}

/* ---------- contar billetes ---------- */

interface BillCounterProps {
  method: PaymentMethod;
  onApply(total: number): void;
  onClose(): void;
}

/** Contar el efectivo billete por billete: se escribe cuántos hay de cada uno y la suma se hace sola. */
function BillCounter({ method, onApply, onClose }: BillCounterProps) {
  const { currency } = method;
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [loose, setLoose] = useState("");
  const [touched, setTouched] = useState(false);

  const counts: Record<number, number> = {};
  let invalid = false;
  for (const bill of BILLS[currency]) {
    const text = (quantities[bill] ?? "").trim();
    if (text === "") continue;
    if (/^\d{1,6}$/.test(text)) counts[bill] = Number(text);
    else invalid = true;
  }
  const looseValue = loose.trim() === "" ? 0 : (parseAmount(loose, currency)?.amount ?? null);
  const total = invalid || looseValue === null ? null : countTotal(currency, counts, looseValue);

  function submit(event: FormEvent) {
    event.preventDefault();
    // Este formulario vive dentro de la ventana de cierre: su envío no debe cerrar la caja.
    event.stopPropagation();
    setTouched(true);
    if (total === null) return;
    onApply(total);
  }

  return (
    <Dialog
      title={t("bills.title", { method: method.name })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="bills-form" className="btn btn--primary">
            {t("bills.apply")}
          </button>
        </>
      }
    >
      <form id="bills-form" className="cash-form" onSubmit={submit} noValidate>
        <p className="muted">{t("bills.lead")}</p>
        <div className="table-wrap">
          <table className="table table--compact bills">
            <thead>
              <tr>
                <th>{t("bills.col.bill")}</th>
                <th className="right">{t("bills.col.qty")}</th>
                <th className="right">{t("bills.col.sum")}</th>
              </tr>
            </thead>
            <tbody>
              {BILLS[currency].map((bill, index) => {
                const label = formatMoney(countTotal(currency, { [bill]: 1 }) ?? 0, currency);
                const sum = countTotal(currency, { [bill]: counts[bill] ?? 0 });
                return (
                  <tr key={bill}>
                    <td className="num">{label}</td>
                    <td className="bills-qty">
                      <input
                        className="input num"
                        aria-label={t("bills.qty.label", { bill: label })}
                        inputMode="numeric"
                        autoComplete="off"
                        data-autofocus={index === 0 ? "" : undefined}
                        value={quantities[bill] ?? ""}
                        onChange={(event) => setQuantities((current) => ({ ...current, [bill]: event.target.value }))}
                      />
                    </td>
                    <td className="right num">{sum ? formatMoney(sum, currency) : <span className="muted">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <Field label={t("bills.loose")}>
          {(props) => <AmountInput {...props} currency={currency} value={loose} placeholder="0,00" onChange={setLoose} />}
        </Field>
        {touched && total === null && <p className="field-error">{t("bills.invalid")}</p>}
        <p className="bills-total" role="status">
          <span>{t("bills.total")}</span>
          <span className="bills-total-value num">{formatMoney(total ?? 0, currency)}</span>
        </p>
      </form>
    </Dialog>
  );
}
