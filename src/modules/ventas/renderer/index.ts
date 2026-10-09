import { ReceiptText, ShoppingBag } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { HistoryScreen } from "./HistoryScreen";
import { ReceiptSettings } from "./ReceiptSettings";
import { SellScreen } from "./SellScreen";
import { t } from "./texts";
import "./ventas.css";

export const ventasModule: RendererModule = {
  manifest,
  screens: [
    { id: "vender", label: t("nav"), icon: ShoppingBag, component: SellScreen, order: 10 },
    { id: "historial", label: t("history.nav"), icon: ReceiptText, component: HistoryScreen, order: 20 },
  ],
  settings: [{ id: "recibos", label: t("settings.title"), component: ReceiptSettings, order: 60 }],
};
