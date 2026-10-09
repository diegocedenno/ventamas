import { FolderOpen } from "lucide-react";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { APP } from "@shared/api";
import { CURRENCIES } from "@shared/money";
import { ADDRESS_MAX, LEGAL_NAME_MAX, PHONE_MAX, STORE_NAME_MAX, TAX_ID_MAX, type SettingKey } from "@shared/settings";
import { hasValidCheck, parseTaxId } from "@shared/taxid";
import type { ThemeId } from "@shared/themes";
import { Field } from "../../../renderer/src/components/Fields";
import { call } from "../../../renderer/src/lib/ipc";
import { useApp } from "../../../renderer/src/state";
import { t } from "./texts";
import { ThemePicker } from "./ThemePicker";

type Feedback = { kind: "ok" | "error"; text: string } | null;

const STORE_TAB = "tienda";
const ABOUT_TAB = "acerca";

/** Ajustes, por secciones: la tienda, lo que añade cada módulo y los datos de la aplicación. */
export function SettingsScreen() {
  const { settingsSections, params } = useApp();
  const [tab, setTab] = useState(params.tab ?? STORE_TAB);
  const tabs = [
    { id: STORE_TAB, label: t("settings.tab.store") },
    ...settingsSections.map((section) => ({ id: section.id, label: section.label })),
    { id: ABOUT_TAB, label: t("settings.tab.about") },
  ];
  const Section = settingsSections.find((section) => section.id === tab)?.component;

  return (
    <div className="page">
      <header>
        <h1 className="page-title">{t("settings.title")}</h1>
      </header>
      <div className="tabs" role="tablist" aria-label={t("settings.tabs")}>
        {tabs.map((item) => (
          <button key={item.id} type="button" className="tab" role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      {tab === STORE_TAB && (
        <>
          <StoreSection />
          <ThemeSection />
        </>
      )}
      {/* Cada módulo añade aquí sus propios ajustes. */}
      {Section && <Section />}
      {tab === ABOUT_TAB && <AboutSection />}
    </div>
  );
}

const STORE_KEYS = ["store.name", "store.address", "store.phone", "store.taxId", "store.legalName"] as const satisfies readonly SettingKey[];
type StoreKey = (typeof STORE_KEYS)[number];

function StoreSection() {
  const { settings, saveSetting } = useApp();
  const [values, setValues] = useState<Record<StoreKey, string>>(() => ({
    "store.name": settings["store.name"],
    "store.address": settings["store.address"],
    "store.phone": settings["store.phone"],
    "store.taxId": settings["store.taxId"],
    "store.legalName": settings["store.legalName"],
  }));
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [saving, setSaving] = useState(false);
  const id = useId();
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const tidy = (text: string) => text.trim().replace(/\s+/g, " ");
  const changed = STORE_KEYS.filter((key) => tidy(values[key]) !== settings[key]);
  const taxId = parseTaxId(values["store.taxId"]);
  const badCheck = taxId !== null && !hasValidCheck(taxId);

  const set = (key: StoreKey) => (text: string) => {
    setValues((current) => ({ ...current, [key]: text }));
    setFeedback(null);
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    window.clearTimeout(timer.current);
    for (const key of changed) {
      const value = key === "store.taxId" ? (taxId?.text ?? values[key]) : values[key];
      const error = await saveSetting(key, value);
      if (error) {
        setSaving(false);
        setFeedback({ kind: "error", text: error });
        return;
      }
    }
    setSaving(false);
    setValues((current) => {
      const next = { ...current };
      for (const key of STORE_KEYS) next[key] = tidy(current[key]);
      if (taxId) next["store.taxId"] = taxId.text;
      return next;
    });
    setFeedback({ kind: "ok", text: t("settings.saved") });
    timer.current = window.setTimeout(() => setFeedback(null), 4000);
  }

  const input = (key: StoreKey, max: number, placeholder?: string) => (props: { id: string; "aria-describedby": string | undefined }) => (
    <input
      {...props}
      className="input"
      value={values[key]}
      maxLength={max}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(event) => set(key)(event.target.value)}
    />
  );

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.store.title")}
      </h2>
      <p className="section-hint">{t("settings.store.hint")}</p>
      <form className="store-form" onSubmit={submit}>
        <Field label={t("settings.store.name")} hint={t("settings.store.name.hint", { max: STORE_NAME_MAX })}>
          {input("store.name", STORE_NAME_MAX, t("settings.store.name.placeholder"))}
        </Field>
        <Field label={t("settings.store.address")}>{input("store.address", ADDRESS_MAX, t("settings.store.address.placeholder"))}</Field>
        <div className="form-grid">
          <Field label={t("settings.store.phone")}>{input("store.phone", PHONE_MAX, t("settings.store.phone.placeholder"))}</Field>
          <Field
            label={t("settings.store.taxId")}
            hint={badCheck ? <span className="field-warning">{t("settings.store.taxId.check")}</span> : undefined}
          >
            {input("store.taxId", TAX_ID_MAX, t("settings.store.taxId.placeholder"))}
          </Field>
        </div>
        <Field label={t("settings.store.legalName")} hint={t("settings.store.legalName.hint")}>
          {input("store.legalName", LEGAL_NAME_MAX)}
        </Field>
        <div className="store-actions">
          <button type="submit" className="btn btn--primary" disabled={saving || changed.length === 0}>
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
      <ThemePicker value={settings["ui.theme"]} onChange={(theme) => void choose(theme)} labelledBy={`${id}-title`} />
      {error && (
        <p className="message message--error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}

function AboutSection() {
  const { info, settings } = useApp();
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
          <dt>{t("settings.currency.title")}</dt>
          <dd>
            {CURRENCIES[settings["store.currency"]].name} <span className="muted">· {t("settings.currency.hint")}</span>
          </dd>
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
        <button type="button" className="btn" onClick={() => void call<void>(APP.openDataDir)}>
          <FolderOpen size={20} strokeWidth={1.75} aria-hidden="true" />
          {t("settings.about.openData")}
        </button>
      </div>
    </section>
  );
}
