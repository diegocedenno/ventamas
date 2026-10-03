import { useId, useState } from "react";
import { APP, type PrinterInfo } from "@shared/api";
import type { ReceiptWidth } from "@shared/settings";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { usePrint } from "../../../renderer/src/components/Print";
import { call, messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import { t } from "./texts";

/** Bloque de Ajustes: con qué impresora y en qué papel salen los recibos. */
export function ReceiptSettings() {
  const { settings, saveSetting } = useApp();
  const printers = useData(() => call<PrinterInfo[]>(APP.printers), []);
  const printer = usePrint();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const id = useId();

  const chosen = settings["receipt.printer"];
  const width = settings["receipt.width"];
  const known = printers.data ?? [];
  // La impresora guardada puede estar desconectada: sigue en la lista para no perderla.
  const missing = chosen !== "" && printers.data !== undefined && !known.some((p) => p.name === chosen);

  async function test() {
    setBusy(true);
    setError(null);
    try {
      await printer.print(
        <div className="doc doc-center">
          {settings["store.name"] && <p className="doc-store">{settings["store.name"]}</p>}
          <p className="doc-tag">{t("settings.test.title").toUpperCase()}</p>
          <hr className="doc-rule" />
          <p>{t("settings.test.body")}</p>
          <hr className="doc-rule" />
          <p className="doc-small">1234567890 · {width} mm</p>
        </div>,
        width
      );
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.title")}
      </h2>
      <div className="form-grid">
        <div className="field">
          <label className="field-label" htmlFor={`${id}-printer`}>
            {t("settings.printer")}
          </label>
          <select
            id={`${id}-printer`}
            className="input"
            value={chosen}
            aria-describedby={`${id}-printer-hint`}
            onChange={async (event) => setError(await saveSetting("receipt.printer", event.target.value))}
          >
            <option value="">{t("settings.printer.ask")}</option>
            {missing && <option value={chosen}>{t("settings.printer.missing", { name: chosen })}</option>}
            {known.map((p) => (
              <option key={p.name} value={p.name}>
                {p.displayName}
              </option>
            ))}
          </select>
          <p className="field-hint" id={`${id}-printer-hint`}>
            {t("settings.printer.hint")}
          </p>
        </div>

        <fieldset className="choice">
          <legend className="field-label">{t("settings.width")}</legend>
          <div className="choice-options">
            {([80, 58] as const).map((option: ReceiptWidth) => (
              <label key={option} className="choice-option">
                <input
                  type="radio"
                  name="ancho"
                  className="sr-only"
                  checked={width === option}
                  onChange={async () => setError(await saveSetting("receipt.width", option))}
                />
                <span>{option === 80 ? t("settings.width.80") : t("settings.width.58")}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>
      <ErrorNote>{error ?? printers.error}</ErrorNote>
      <div>
        <button type="button" className="btn" disabled={busy} onClick={() => void test()}>
          {t("settings.test")}
        </button>
      </div>
    </section>
  );
}
