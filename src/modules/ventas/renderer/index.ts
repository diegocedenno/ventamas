import { ShoppingBag } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { ReceiptSettings } from "./ReceiptSettings";
import { SellScreen } from "./SellScreen";
import { t } from "./texts";
import "./ventas.css";

export const ventasModule: RendererModule = {
  manifest,
  screens: [{ id: "vender", label: t("nav"), icon: ShoppingBag, component: SellScreen, order: 10 }],
  settings: [{ id: "recibos", component: ReceiptSettings, order: 30 }],
};
