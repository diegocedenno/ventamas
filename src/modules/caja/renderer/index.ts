import { Wallet } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { CashScreen } from "./CashScreen";
import { MethodsSettings } from "./MethodsSettings";
import { t } from "./texts";
import "./caja.css";

export const cajaModule: RendererModule = {
  manifest,
  screens: [{ id: "caja", label: t("nav"), icon: Wallet, component: CashScreen, order: 30 }],
  settings: [{ id: "medios-de-pago", component: MethodsSettings, order: 20 }],
};
