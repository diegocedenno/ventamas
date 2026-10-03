import { Shirt } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { ProductsScreen } from "./ProductsScreen";
import { t } from "./texts";
import "./inventario.css";

export const inventarioModule: RendererModule = {
  manifest,
  screens: [{ id: "productos", label: t("nav"), icon: Shirt, component: ProductsScreen, order: 20 }],
};
