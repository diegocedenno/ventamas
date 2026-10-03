import { FolderOpen } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { STORE_NAME_MAX } from "@shared/settings";
import { THEMES, type ThemeId } from "@shared/themes";
import { t } from "../../../renderer/src/i18n/es";
import { useApp } from "../../../renderer/src/state";

type Feedback = { kind: "ok" | "error"; text: string } | null;

export function SettingsScreen() {
  return (
    <div className="page">
      <header>
        <h1 className="page-title">{t("settings.title")}</h1>
      </header>
      <StoreSection />
      <ThemeSection />
      <AboutSection />
    </div>
  );
}

function StoreSection() {
  const { settings, saveSetting } = useApp();
  const saved = settings["store.name"];
  const [name, setName] = useState(saved);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    const error = await saveSetting("store.name", name);
    setSaving(false);
    window.clearTimeout(timer.current);
    if (error) {
      setFeedback({ kind: "error", text: error });
      return;
    }
    setName((current) => current.trim().replace(/\s+/g, " "));
    setFeedback({ kind: "ok", text: t("settings.saved") });
    timer.current = window.setTimeout(() => setFeedback(null), 4000);
  }

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.store.title")}
      </h2>
      <form className="store-form" onSubmit={submit}>
        <div className="field">
          <label className="field-label" htmlFor={`${id}-name`}>
            {t("settings.store.name")}
          </label>
          <input
            className="input"
            id={`${id}-name`}
            value={name}
            maxLength={STORE_NAME_MAX}
            placeholder={t("settings.store.name.placeholder")}
            aria-describedby={`${id}-hint`}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => {
              setName(event.target.value);
              setFeedback(null);
            }}
          />
          <p className="field-hint" id={`${id}-hint`}>
            {t("settings.store.name.hint", { max: STORE_NAME_MAX })}
          </p>
        </div>
        <div className="store-actions">
          <button type="submit" className="btn btn--primary" disabled={saving || name.trim() === saved}>
            {t("settings.save")}
          </button>
          <p className={`message message--${feedback?.kind ?? "ok"}`} role="status">
            {feedback?.text}
          </p>
        </div>
      </form>
    </section>
  );
}

function ThemeSection() {
  const { settings, saveSetting } = useApp();
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function choose(theme: ThemeId) {
    setError(await saveSetting("ui.theme", theme));
  }

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.theme.title")}
      </h2>
      <p className="section-hint">{t("settings.theme.hint")}</p>
      <div className="themes" role="radiogroup" aria-labelledby={`${id}-title`}>
        {THEMES.map((theme) => (
          <label key={theme.id} className="theme">
            <input
              className="sr-only"
              type="radio"
              name="tema"
              value={theme.id}
              checked={settings["ui.theme"] === theme.id}
              onChange={() => void choose(theme.id)}
            />
            <span
              className="theme-preview"
              aria-hidden="true"
              style={{ background: theme.colors.bg, borderColor: theme.colors.border }}
            >
              <span className="theme-preview-side" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
                <i style={{ background: theme.colors.accent }} />
                <i style={{ background: theme.colors.text2 }} />
                <i style={{ background: theme.colors.text2 }} />
              </span>
              <span className="theme-preview-main">
                <i style={{ background: theme.colors.text }} />
                <i style={{ background: theme.colors.accent }} />
              </span>
            </span>
            <span className="theme-name">
              {theme.name}
              {theme.scheme === "dark" && <span className="theme-tag">{t("settings.theme.dark")}</span>}
            </span>
          </label>
        ))}
      </div>
      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function AboutSection() {
  const { info } = useApp();
  const id = useId();

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.about.title")}
      </h2>
      <dl className="facts">
        <div>
          <dt>{t("settings.about.version")}</dt>
          <dd className="num">{info.version}</dd>
        </div>
        <div>
          <dt>{t("settings.about.license")}</dt>
          <dd>{t("settings.about.license.value")}</dd>
        </div>
        <div>
          <dt>{t("settings.about.data")}</dt>
          <dd className="facts-path selectable">{info.dataDir}</dd>
        </div>
      </dl>
      <div>
        <button type="button" className="btn" onClick={() => void window.ventamas.app.openDataDir()}>
          <FolderOpen size={20} strokeWidth={1.75} aria-hidden="true" />
          {t("settings.about.openData")}
        </button>
      </div>
    </section>
  );
}
