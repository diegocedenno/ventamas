import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { rendererModules } from "@modules/registry.renderer";
import { App } from "./App";
import { PrintProvider } from "./components/Print";
import { AppProvider } from "./state";
import { applyTheme } from "./theme";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/kit.css";
import "./styles/print.css";

// El tema se aplica antes del primer pintado: la ventana nunca aparece con otro color.
applyTheme(window.ventamas.boot.settings["ui.theme"]);

const screens = rendererModules.flatMap((module) => module.screens).sort((a, b) => a.order - b.order);
const settingsSections = rendererModules.flatMap((module) => module.settings ?? []).sort((a, b) => a.order - b.order);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppProvider screens={screens} settingsSections={settingsSections}>
      <PrintProvider>
        <App />
      </PrintProvider>
    </AppProvider>
  </StrictMode>
);
