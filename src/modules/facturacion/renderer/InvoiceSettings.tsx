import { TriangleAlert } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { INVOICE_MODES, INVOICE_SERIES_MAX, INVOICE_TOP_MAX, type InvoiceMode } from "@shared/settings";
import { Segmented } from "../../../renderer/src/components/Choices";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { SettingSwitch } from "../../../renderer/src/components/SettingSwitch";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { formatControl, LOT_PRINTER_MAX } from "../api";
import { facturacion } from "./client";
import { t } from "./texts";

/** Bloque de Ajustes: si la tienda factura con Ventamas, cómo, y con qué formas libres. */
export function InvoiceSettings() {
  const { settings, saveSetting } = useApp();
  const mode = settings["invoice.mode"];
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  return (
    <>
      <section className="card section" aria-labelledby={`${id}-title`}>
        <h2 className="section-title" id={`${id}-title`}>
          {t("settings.title")}
        </h2>
        <p className="section-hint">{t("settings.lead")}</p>

        <div className="invoice-modes" role="radiogroup" aria-label={t("mode")}>
          {INVOICE_MODES.map((option) => (
            <label key={option} className="invoice-mode">
              <input
                className="sr-only"
                type="radio"
                name="invoice-mode"
                value={option}
                checked={mode === option}
                onChange={async () => setError(await saveSetting("invoice.mode", option))}
              />
              <span className="invoice-mode-name">{t(`mode.${option}` as `mode.${InvoiceMode}`)}</span>
              <span className="invoice-mode-hint muted">{t(`mode.${option}.hint` as `mode.${InvoiceMode}.hint`)}</span>
            </label>
          ))}
        </div>
        <p className="field-hint">{t("settings.review")}</p>
        <ErrorNote>{error}</ErrorNote>
      </section>

      {mode === "forma-libre" && <FormaLibreSettings />}
    </>
  );
}

function FormaLibreSettings() {
  const { settings, saveSetting } = useApp();
  const status = useData(() => facturacion.status(), [settings]);
  const [series, setSeries] = useState(settings["invoice.series"]);
  const [start, setStart] = useState(String(settings["invoice.start"]));
  const [top, setTop] = useState(String(settings["invoice.top"]));
  const [touched, setTouched] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  const startInvalid = !/^[1-9]\d{0,7}$/.test(start.trim());
  const topInvalid = !/^\d{1,3}$/.test(top.trim()) || Number(top) > INVOICE_TOP_MAX;
  const issuerMissing = (status.data?.missing ?? []).filter((item) => item.includes("tienda"));
  const issuerName = settings["store.legalName"] || settings["store.name"];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setSaved(false);
    if (startInvalid || topInvalid) return;
    const failure =
      (await saveSetting("invoice.series", series.trim().toUpperCase())) ??
      (await saveSetting("invoice.start", Number(start.trim()))) ??
      (await saveSetting("invoice.top", Number(top.trim())));
    setError(failure);
    setSaved(failure === null);
  }

  return (
    <>
      <section className="card section notice-card">
        <div className="invoice-warning">
          <TriangleAlert className="invoice-warning-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
          <div className="stack">
            <h2 className="section-title">{t("fiscal.title")}</h2>
            <p>{t("fiscal.body")}</p>
            <ol className="invoice-list">
              <li>{t("fiscal.1")}</li>
              <li>{t("fiscal.2")}</li>
              <li>{t("fiscal.3")}</li>
            </ol>
            <p>
              <strong>{t("fiscal.result")}</strong>
            </p>
          </div>
        </div>
      </section>

      <section className="card section" aria-labelledby={`${id}-issuer`}>
        <h2 className="section-title" id={`${id}-issuer`}>
          {t("issuer.title")}
        </h2>
        {issuerMissing.length > 0 ? (
          <p className="note note--error">{t("issuer.missing", { what: issuerMissing.join("; ") })}</p>
        ) : (
          <p className="num">{t("issuer.ok", { name: issuerName, taxId: settings["store.taxId"], address: settings["store.address"] })}</p>
        )}
        <p className="section-hint">{t("issuer.edit")}</p>

        <div className="stack">
          <Segmented
            label={t("regime")}
            showLabel
            value={settings["invoice.regime"]}
            options={[
              { value: "ordinario", label: t("regime.ordinario") },
              { value: "formal", label: t("regime.formal") },
            ]}
            onChange={async (value) => setError(await saveSetting("invoice.regime", value))}
          />
          <p className="field-hint">{settings["invoice.regime"] === "ordinario" ? t("regime.ordinario.hint") : t("regime.formal.hint")}</p>
          {settings["invoice.regime"] === "ordinario" && !settings["tax.enabled"] && <p className="note note--error">{t("regime.tax.off")}</p>}
        </div>
      </section>

      <section className="card section" aria-labelledby={`${id}-numbering`}>
        <h2 className="section-title" id={`${id}-numbering`}>
          {t("numbering.title")}
        </h2>
        <form className="stack" onSubmit={submit} noValidate>
          <div className="form-grid">
            <Field label={t("series")} hint={t("series.hint")}>
              {(props) => (
                <input
                  {...props}
                  className="input"
                  value={series}
                  maxLength={INVOICE_SERIES_MAX}
                  autoComplete="off"
                  spellCheck={false}
                  onChange={(event) => setSeries(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""))}
                />
              )}
            </Field>
            <Field label={t("start")} hint={t("start.hint")} error={touched && startInvalid ? t("start.invalid") : null}>
              {(props) => (
                <input {...props} className="input num" inputMode="numeric" value={start} autoComplete="off" onChange={(event) => setStart(event.target.value)} />
              )}
            </Field>
          </div>
          {status.data && <p className="muted num">{t("next", { number: status.data.nextNumber })}</p>}

          <h3 className="subsection-title">{t("paper.title")}</h3>
          <div className="form-grid">
            <Segmented
              label={t("paper")}
              showLabel
              value={settings["invoice.paper"]}
              options={[
                { value: "carta", label: t("paper.carta") },
                { value: "media-carta", label: t("paper.media-carta") },
              ]}
              onChange={async (value) => setError(await saveSetting("invoice.paper", value))}
            />
            <Field label={t("top")} hint={t("top.hint")} error={touched && topInvalid ? t("top.invalid") : null}>
              {(props) => (
                <input {...props} className="input num" inputMode="numeric" value={top} autoComplete="off" onChange={(event) => setTop(event.target.value)} />
              )}
            </Field>
          </div>
          <SettingSwitch setting="invoice.header" label={t("header")} onResult={setError} />
          <p className="section-hint">{t("header.hint")}</p>

          <div className="store-actions">
            <button type="submit" className="btn btn--primary">
              {t("save")}
            </button>
            <p className="message message--ok" role="status">
              {saved && t("saved")}
            </p>
          </div>
        </form>
        <ErrorNote>{error ?? status.error}</ErrorNote>
      </section>

      <LotSection onChanged={() => void status.reload()} status={status.data} />
    </>
  );
}

function LotSection({ status, onChanged }: { status: Awaited<ReturnType<typeof facturacion.status>> | undefined; onChanged(): void }) {
  const [prefix, setPrefix] = useState("00");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [printer, setPrinter] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();
  const id = useId();

  const whole = (text: string) => (/^\d{1,8}$/.test(text.trim()) ? Number(text.trim()) : null);
  const firstValue = whole(first);
  const lastValue = whole(last);
  const lot = status?.lot ?? null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setDone(false);
    if (firstValue === null || lastValue === null) return;
    await once(async () => {
      setError(null);
      try {
        await facturacion.saveLot({ prefix: prefix.trim(), first: firstValue, last: lastValue, printer });
        setFirst("");
        setLast("");
        setTouched(false);
        setDone(true);
        onChanged();
      } catch (reason) {
        setError(messageOf(reason));
      }
    });
  }

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("lot.title")}
      </h2>
      {status && !lot && <p className="section-hint">{t("lot.none")}</p>}
      {lot && (
        <div className="stack">
          <p className="num">
            {t("lot.current", {
              first: formatControl(lot.prefix, lot.first),
              last: formatControl(lot.prefix, lot.last),
              printer: lot.printer ? t("lot.printer", { name: lot.printer }) : "",
            })}
          </p>
          {status?.nextControl ? (
            <p className="num">{t("lot.next", { control: status.nextControl, count: status.remaining })}</p>
          ) : (
            <p className="note note--error">{t("lot.exhausted")}</p>
          )}
        </div>
      )}

      <form className="stack" onSubmit={submit} noValidate>
        <h3 className="subsection-title">{t("lot.new")}</h3>
        <div className="form-grid">
          <Field label={t("lot.prefix")} hint={t("lot.prefix.hint")}>
            {(props) => (
              <input
                {...props}
                className="input num"
                inputMode="numeric"
                value={prefix}
                maxLength={4}
                autoComplete="off"
                onChange={(event) => setPrefix(event.target.value.replace(/\D/g, ""))}
              />
            )}
          </Field>
          <Field label={t("lot.first")}>
            {(props) => (
              <input {...props} className="input num" inputMode="numeric" value={first} autoComplete="off" onChange={(event) => setFirst(event.target.value)} />
            )}
          </Field>
          <Field label={t("lot.last")}>
            {(props) => (
              <input {...props} className="input num" inputMode="numeric" value={last} autoComplete="off" onChange={(event) => setLast(event.target.value)} />
            )}
          </Field>
        </div>
        <Field label={t("lot.name")}>
          {(props) => (
            <input {...props} className="input" value={printer} maxLength={LOT_PRINTER_MAX} autoComplete="off" onChange={(event) => setPrinter(event.target.value)} />
          )}
        </Field>
        {touched && (firstValue === null || lastValue === null) && <p className="field-error">{t("lot.invalid")}</p>}
        <div className="store-actions">
          <button type="submit" className="btn">
            {t("lot.save")}
          </button>
          <p className="message message--ok" role="status">
            {done && t("lot.saved")}
          </p>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </form>
    </section>
  );
}
