import { CloudDownload } from "lucide-react";
import { useState, type FormEvent } from "react";
import { CURRENCIES, formatRate, parseRate, type CurrencyCode } from "@shared/money";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { formatDay } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { FOREIGN, type RatesState, type RateSource } from "../api";
import { monedas } from "./client";
import { t } from "./texts";

interface RatesFormProps {
  state: RatesState;
  /** Se llama con el estado nuevo cuando las tasas quedan confirmadas. */
  onSaved(state: RatesState): void;
}

const initial = (state: RatesState): Record<string, string> =>
  Object.fromEntries(FOREIGN.map((code) => [code, state.rates[code] ? formatRate(state.rates[code].rate) : ""]));

/**
 * Formulario de las tasas del día. Parte de las últimas tasas conocidas; el dueño las
 * confirma tal cual, las corrige a mano o trae la tasa oficial y la revisa antes de guardar.
 */
export function RatesForm({ state, onSaved }: RatesFormProps) {
  const [values, setValues] = useState(() => initial(state));
  const [source, setSource] = useState<RateSource>("manual");
  const [fetchedDate, setFetchedDate] = useState<string | null>(null);
  const [busy, setBusy] = useState<"fetch" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [touched, setTouched] = useState(false);
  const once = useOnce();

  const parsed = Object.fromEntries(FOREIGN.map((code) => [code, parseRate(values[code] ?? "")])) as Record<
    CurrencyCode,
    number | null
  >;
  const valid = FOREIGN.every((code) => parsed[code] !== null);

  async function fetchOfficial() {
    setBusy("fetch");
    setError(null);
    try {
      const official = await monedas.fetchOfficial();
      setValues(Object.fromEntries(FOREIGN.map((code) => [code, formatRate(official.rates[code] ?? 0)])));
      setSource("bcv");
      setFetchedDate(official.date);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    await once(async () => {
      setBusy("save");
      setError(null);
      try {
        const rates = Object.fromEntries(FOREIGN.map((code) => [code, parsed[code] as number]));
        onSaved(await monedas.save({ rates, source }));
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusy(null);
      }
    });
  }

  return (
    <form className="rates-form" onSubmit={submit} noValidate>
      <div className="form-grid">
        {FOREIGN.map((code, index) => (
          <Field
            key={code}
            label={t("field", { currency: CURRENCIES[code].name.toLowerCase() })}
            error={touched && parsed[code] === null ? t("field.invalid") : null}
            hint={parsed[code] !== null ? `1 ${CURRENCIES[code].symbol} = Bs ${formatRate(parsed[code])}` : undefined}
          >
            {(props) => (
              <input
                {...props}
                className="input num"
                inputMode="decimal"
                autoComplete="off"
                autoFocus={index === 0}
                value={values[code] ?? ""}
                onChange={(event) => {
                  setValues((current) => ({ ...current, [code]: event.target.value }));
                  // Una tasa corregida a mano ya no es la oficial.
                  setSource("manual");
                  setFetchedDate(null);
                }}
              />
            )}
          </Field>
        ))}
      </div>

      {fetchedDate && <p className="note note--info">{t("fetched", { date: formatDay(fetchedDate) })}</p>}
      <ErrorNote>{error}</ErrorNote>

      <div className="rates-actions">
        <button type="submit" className="btn btn--primary" disabled={busy !== null}>
          {state.confirmedToday ? t("update") : t("confirm")}
        </button>
        <button type="button" className="btn" disabled={busy !== null} onClick={() => void fetchOfficial()}>
          <CloudDownload size={20} strokeWidth={1.75} aria-hidden="true" />
          {busy === "fetch" ? t("fetching") : t("fetch")}
        </button>
      </div>
    </form>
  );
}
