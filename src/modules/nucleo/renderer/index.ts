import { Settings } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { SettingsScreen } from "./SettingsScreen";
import { t } from "./texts";
import "./settings.css";

export const nucleoModule: RendererModule = {
  manifest,
  screens: [{ id: "ajustes", label: t("nav.settings"), icon: Settings, component: SettingsScreen, order: 90, footer: true }],
};
