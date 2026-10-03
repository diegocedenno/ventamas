import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App, screens } from "./App";
import { AppProvider } from "./state";
import { applyTheme } from "./theme";
import "./styles/base.css";
import "./styles/shell.css";
import "./styles/screens.css";

// El tema se aplica antes del primer pintado: la ventana nunca aparece con otro color.
applyTheme(window.ventamas.boot.settings["ui.theme"]);

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <AppProvider initialScreen={screens[0]?.id ?? ""}>
      <App />
    </AppProvider>
  </StrictMode>
);
