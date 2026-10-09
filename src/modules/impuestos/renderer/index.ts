import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { TaxSettings } from "./TaxSettings";
import { t } from "./texts";

export const impuestosModule: RendererModule = {
  manifest,
  screens: [],
  settings: [{ id: "impuestos", label: t("settings.title"), component: TaxSettings, order: 40 }],
};
