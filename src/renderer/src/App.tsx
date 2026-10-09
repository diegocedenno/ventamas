import { useEffect, useRef } from "react";
import { Welcome } from "@modules/nucleo/renderer";
import { Logo } from "./components/Logo";
import { t } from "./i18n/es";
import type { Screen } from "./modules";
import { useApp } from "./state";

export function App() {
  const { settings, info, screen, goTo, screens } = useApp();
  const main = useRef<HTMLElement>(null);
  const current = screens.find((s) => s.id === screen) ?? screens[0];

  // Al cambiar de pantalla, el contenido vuelve arriba y recibe el foco (lectores de pantalla).
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    main.current?.scrollTo(0, 0);
    main.current?.focus();
  }, [screen]);

  // Una tienda nueva pasa primero por el asistente de bienvenida.
  if (!settings["setup.done"]) return <Welcome />;
  if (!current) return null;
  const Current = current.component;

  const item = ({ id, label, icon: Icon }: Screen) => (
    <button
      key={id}
      type="button"
      className="nav-item"
      aria-current={id === current.id ? "page" : undefined}
      onClick={() => goTo(id)}
    >
      <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
      {label}
    </button>
  );

  return (
    <div className="shell">
      <a className="skip-link" href="#contenido">
        {t("app.skip")}
      </a>

      <aside className="sidebar">
        <div className="brand">
          <Logo className="brand-mark" />
          <div className="brand-text">
            <span className="brand-name">{t("app.name")}</span>
            <span className="brand-store" title={settings["store.name"] || undefined}>
              {settings["store.name"] || t("store.unnamed")}
            </span>
          </div>
        </div>

        <nav className="nav" aria-label={t("nav.label")}>
          {screens.filter((s) => !s.footer).map(item)}
        </nav>

        <div className="sidebar-foot">
          <div className="nav">{screens.filter((s) => s.footer).map(item)}</div>
          <p className="sidebar-version num">v{info.version}</p>
        </div>
      </aside>

      <main className="content" id="contenido" ref={main} tabIndex={-1}>
        {/* La clave reinicia la pantalla al volver a ella: siempre abre con datos frescos. */}
        <Current key={current.id} />
      </main>
    </div>
  );
}
