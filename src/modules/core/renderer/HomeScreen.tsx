import { CircleCheck, Palette } from "lucide-react";
import { t } from "../../../renderer/src/i18n/es";
import { useApp } from "../../../renderer/src/state";

export function HomeScreen() {
  const { settings, goTo } = useApp();
  const name = settings["store.name"];

  return (
    <div className="page">
      <header>
        <h1 className="page-title">{name ? `${t("home.greeting")}, ${name}` : t("home.greeting")}</h1>
      </header>

      <section className="card notice">
        <CircleCheck className="notice-icon notice-icon--ok" size={24} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <h2 className="notice-title">{t("home.ready.title")}</h2>
          <p className="notice-body">{t("home.ready.body")}</p>
        </div>
      </section>

      <section className="card notice">
        <Palette className="notice-icon" size={24} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <h2 className="notice-title">{t("home.setup.title")}</h2>
          <p className="notice-body">{name ? t("home.setup.done") : t("home.setup.body")}</p>
          <button type="button" className={name ? "btn" : "btn btn--primary"} onClick={() => goTo("ajustes")}>
            {t("home.setup.action")}
          </button>
        </div>
      </section>
    </div>
  );
}
