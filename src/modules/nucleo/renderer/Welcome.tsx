import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from "react";
import type { CurrencyCode } from "@shared/money";
import { STORE_NAME_MAX, type Settings } from "@shared/settings";
import type { ThemeId } from "@shared/themes";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { Logo } from "../../../renderer/src/components/Logo";
import { call, messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp, useSlot } from "../../../renderer/src/state";
import { applyTheme } from "../../../renderer/src/theme";
import { NUCLEO, type SetupInput } from "../api";
import { t } from "./texts";
import { ThemePicker } from "./ThemePicker";
import { WELCOME_SLOT, type WelcomeStepProps } from "./welcomeSlot";

const CURRENCY_OPTIONS: ReadonlyArray<{ code: CurrencyCode; label: string; hint: string }> = [
  { code: "USD", label: t("welcome.money.USD"), hint: t("welcome.money.USD.hint") },
  { code: "VES", label: t("welcome.money.VES"), hint: t("welcome.money.VES.hint") },
  { code: "EUR", label: t("welcome.money.EUR"), hint: t("welcome.money.EUR.hint") },
];

/**
 * Asistente de bienvenida: lo mínimo que Ventamas no puede adivinar. Aparece una sola
 * vez, en una tienda nueva, y se puede omitir. Otros módulos añaden sus pasos en medio
 * (el tipo de comercio lo pone el inventario).
 */
export function Welcome() {
  const { settings, applySettings } = useApp();
  const extraSteps = useSlot<WelcomeStepProps>(WELCOME_SLOT);
  const total = extraSteps.length + 2;
  const [step, setStep] = useState(0);
  const [storeName, setStoreName] = useState(settings["store.name"]);
  const [currency, setCurrency] = useState<CurrencyCode>(settings["store.currency"]);
  const [theme, setTheme] = useState<ThemeId>(settings["ui.theme"]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const id = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  // Lo que cada paso añadido por otro módulo quiere guardar al continuar.
  const commits = useRef(new Map<number, () => Promise<void>>());
  const once = useOnce();

  // Al cambiar de paso, el foco va a su primer campo, o al título si no tiene.
  useEffect(() => {
    const fields = document.querySelectorAll<HTMLElement>(".welcome-step :is(input, select, textarea)");
    // Los pasos que no están a la vista siguen montados: su primer campo no cuenta.
    const first = [...fields].find((field) => field.closest("[hidden]") === null);
    (first ?? heading.current)?.focus();
  }, [step]);

  const register = useCallback(
    (index: number) => (handler: () => Promise<void>) => {
      commits.current.set(index, handler);
    },
    []
  );

  function chooseTheme(next: ThemeId) {
    setTheme(next);
    // Se ve al instante; se guarda al terminar.
    applyTheme(next);
  }

  async function finish(input: SetupInput | undefined) {
    applySettings(await call<Settings>(NUCLEO.finishSetup, input));
  }

  async function next(event: FormEvent) {
    event.preventDefault();
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        await commits.current.get(step)?.();
        if (step < total - 1) setStep(step + 1);
        else await finish({ storeName, currency, theme });
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    });
  }

  async function skip() {
    await once(async () => {
      setBusy(true);
      try {
        // Omitir deja todo por defecto, también el color que se estuviera probando.
        applyTheme(settings["ui.theme"]);
        await finish(undefined);
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  const last = step === total - 1;

  return (
    <main className="welcome">
      <form className="welcome-card card" onSubmit={next} aria-labelledby={`${id}-hello`}>
        <header className="welcome-head">
          <Logo className="welcome-logo" />
          <div>
            <h1 className="welcome-hello" id={`${id}-hello`} ref={heading} tabIndex={-1}>
              {t("welcome.hello")}
            </h1>
            <p className="muted">{t("welcome.lead")}</p>
          </div>
        </header>

        <div className="welcome-progress" role="status">
          <span className="welcome-count">{t("welcome.step", { step: step + 1, total })}</span>
          <span className="welcome-dots" aria-hidden="true">
            {Array.from({ length: total }, (_, index) => (
              <i key={index} className={index <= step ? "is-done" : undefined} />
            ))}
          </span>
        </div>

        <div className="welcome-step">
          {step === 0 && (
            <>
              <div>
                <h2 className="welcome-title">{t("welcome.name.title")}</h2>
                <p className="welcome-body">{t("welcome.name.body")}</p>
              </div>
              <Field label={t("settings.store.name")} hint={t("welcome.name.skip")}>
                {(props) => (
                  <input
                    {...props}
                    className="input welcome-name"
                    value={storeName}
                    maxLength={STORE_NAME_MAX}
                    placeholder={t("settings.store.name.placeholder")}
                    autoComplete="off"
                    spellCheck={false}
                    onChange={(event) => setStoreName(event.target.value)}
                  />
                )}
              </Field>
            </>
          )}

          {/* Los pasos de otros módulos quedan montados: al volver atrás conservan lo elegido. */}
          {extraSteps.map((Extra, index) => (
            <div className="welcome-extra" key={index} hidden={step !== index + 1}>
              <Extra onCommit={register(index + 1)} />
            </div>
          ))}

          {last && (
            <>
              <div>
                <h2 className="welcome-title">{t("welcome.money.title")}</h2>
                <p className="welcome-body">{t("welcome.money.body")}</p>
              </div>
              <div className="welcome-currencies" role="radiogroup" aria-label={t("welcome.money.label")}>
                {CURRENCY_OPTIONS.map((option) => (
                  <label key={option.code} className="welcome-currency">
                    <input
                      className="sr-only"
                      type="radio"
                      name="moneda"
                      value={option.code}
                      checked={currency === option.code}
                      onChange={() => setCurrency(option.code)}
                    />
                    <span className="welcome-currency-name">{option.label}</span>
                    <span className="welcome-currency-hint muted">{option.hint}</span>
                  </label>
                ))}
              </div>
              <p className="field-hint">{t("welcome.money.fixed")}</p>
              <h2 className="welcome-title" id={`${id}-theme`}>
                {t("welcome.theme.title")}
              </h2>
              <ThemePicker value={theme} onChange={chooseTheme} labelledBy={`${id}-theme`} />
            </>
          )}
        </div>

        <ErrorNote>{error}</ErrorNote>

        <footer className="welcome-foot">
          <button type="button" className="btn btn--quiet spacer" disabled={busy} onClick={() => void skip()}>
            {t("welcome.skip")}
          </button>
          {step > 0 && (
            <button type="button" className="btn" disabled={busy} onClick={() => setStep(step - 1)}>
              {t("welcome.back")}
            </button>
          )}
          <button type="submit" className="btn btn--primary" disabled={busy}>
            {last ? t("welcome.finish") : t("welcome.next")}
          </button>
        </footer>
      </form>
    </main>
  );
}
