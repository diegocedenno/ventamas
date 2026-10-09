import { Package } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { WELCOME_SLOT } from "../../nucleo/renderer/welcomeSlot";
import { manifest } from "../manifest";
import { CategoriesSettings } from "./CategoriesSettings";
import { ProductsScreen } from "./ProductsScreen";
import { t } from "./texts";
import { WelcomeRubros } from "./WelcomeRubros";
import "./inventario.css";

export const inventarioModule: RendererModule = {
  manifest,
  screens: [{ id: "productos", label: t("nav"), icon: Package, component: ProductsScreen, order: 30 }],
  settings: [{ id: "categorias", label: t("cats.label"), component: CategoriesSettings, order: 20 }],
  slots: [{ slot: WELCOME_SLOT, component: WelcomeRubros, order: 10 }],
};
