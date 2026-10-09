import { Wallet } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { CashScreen } from "./CashScreen";
import { MethodsSettings } from "./MethodsSettings";
import { t } from "./texts";
import "./caja.css";

export const cajaModule: RendererModule = {
  manifest,
  screens: [{ id: "caja", label: t("nav"), icon: Wallet, component: CashScreen, order: 50 }],
  settings: [{ id: "caja", label: t("settings.label"), component: MethodsSettings, order: 30 }],
};
