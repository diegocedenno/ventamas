import { ArrowLeftRight } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { RatesScreen } from "./RatesScreen";
import { t } from "./texts";
import "./monedas.css";

export const monedasModule: RendererModule = {
  manifest,
  screens: [{ id: "tasas", label: t("nav"), icon: ArrowLeftRight, component: RatesScreen, order: 40 }],
};
