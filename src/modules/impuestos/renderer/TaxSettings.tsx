import { Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { parseDecimal } from "@shared/money";
import { Segmented } from "../../../renderer/src/components/Choices";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { SettingSwitch } from "../../../renderer/src/components/SettingSwitch";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { formatTaxRate, TAX_CODE_MAX, TAX_NAME_MAX, TAX_RATE_MAX, type TaxClass } from "../api";
import { impuestos } from "./client";
import { t } from "./texts";

/** Bloque de Ajustes: si la tienda desglosa impuestos, cómo y con qué tasas. */
export function TaxSettings() {
  const { settings, saveSetting } = useApp();
  const taxes = useData(() => impuestos.list(), []);
  // undefined: cerrado · null: tasa nueva · TaxClass: edición
  const [editing, setEditing] = useState<TaxClass | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const enabled = settings["tax.enabled"];

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.title")}
      </h2>
      <p className="section-hint">{t("settings.hint")}</p>

      <SettingSwitch setting="tax.enabled" label={t("settings.enabled")} onResult={setError} />

      {enabled && (
        <>
          <div className="stack">
            <Segmented
              label={t("settings.included")}
              showLabel
              value={settings["tax.included"] ? "yes" : "no"}
              options={[
                { value: "yes", label: t("settings.included.yes") },
                { value: "no", label: t("settings.included.no") },
              ]}
              onChange={async (value) => setError(await saveSetting("tax.included", value === "yes"))}
            />
            <p className="field-hint">{settings["tax.included"] ? t("settings.included.yes.hint") : t("settings.included.no.hint")}</p>
          </div>

          <div className="stack">
            <div>
              <h3 className="subsection-title">{t("settings.rates")}</h3>
              <p className="field-hint">{t("settings.rates.hint")}</p>
            </div>
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>{t("col.name")}</th>
                    <th>{t("col.code")}</th>
                    <th className="right">{t("col.rate")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {(taxes.data ?? []).map((tax) => (
                    <tr key={tax.id}>
                      <td>
                        {tax.name} {!tax.active && <span className="badge">{t("inactive")}</span>}
                      </td>
                      <td>{tax.code}</td>
                      <td className="right num">{formatTaxRate(tax.rate)}</td>
                      <td className="right">
                        <button type="button" className="link" aria-label={`${t("edit")} ${tax.name}`} onClick={() => setEditing(tax)}>
                          {t("edit")}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <button type="button" className="btn" onClick={() => setEditing(null)}>
                <Plus size={20} strokeWidth={2} aria-hidden="true" />
                {t("add")}
              </button>
            </div>
          </div>
        </>
      )}

      <ErrorNote>{error ?? taxes.error}</ErrorNote>
      {editing !== undefined && <TaxEditor tax={editing} onClose={() => setEditing(undefined)} onSaved={(list) => taxes.set(list)} />}
    </section>
  );
}

function TaxEditor({ tax, onClose, onSaved }: { tax: TaxClass | null; onClose(): void; onSaved(list: TaxClass[]): void }) {
  const [name, setName] = useState(tax?.name ?? "");
  const [code, setCode] = useState(tax?.code ?? "");
  const [rate, setRate] = useState(tax ? String(tax.rate / 100).replace(".", ",") : "");
  const [active, setActive] = useState(tax?.active ?? true);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const rateValue = parseDecimal(rate, 2);
  const rateInvalid = rateValue === null || rateValue > TAX_RATE_MAX;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (name.trim() === "" || rateInvalid) return;
    await once(async () => {
      try {
        onSaved(await impuestos.save({ id: tax?.id, name, code, rate: rateValue, active }));
        onClose();
      } catch (reason) {
        setError(messageOf(reason));
      }
    });
  }

  return (
    <Dialog
      title={tax ? t("editor.edit") : t("editor.new")}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="tax-form" className="btn btn--primary">
            {t("save")}
          </button>
        </>
      }
    >
      <form id="tax-form" className="stack" onSubmit={submit} noValidate>
        <Field label={t("name")} error={touched && name.trim() === "" ? t("name.required") : null}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={name}
              maxLength={TAX_NAME_MAX}
              placeholder={t("name.placeholder")}
              autoComplete="off"
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </Field>
        <div className="form-grid">
          <Field label={t("rate")} error={touched && rateInvalid ? t("rate.invalid") : null}>
            {(props) => (
              <input
                {...props}
                className="input num"
                inputMode="decimal"
                value={rate}
                autoComplete="off"
                onChange={(event) => setRate(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("code")} hint={t("code.hint")}>
            {(props) => (
              <input {...props} className="input" value={code} maxLength={TAX_CODE_MAX} autoComplete="off" onChange={(event) => setCode(event.target.value)} />
            )}
          </Field>
        </div>
        {tax?.id !== "general" && (
          <label className="check">
            <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} />
            <span>
              {t("active")} <span className="muted">· {t("active.hint")}</span>
            </span>
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}
