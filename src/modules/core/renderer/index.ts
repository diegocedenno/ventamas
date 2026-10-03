import { House, Settings } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { HomeScreen } from "./HomeScreen";
import { SettingsScreen } from "./SettingsScreen";

export const coreModule: RendererModule = {
  manifest,
  screens: [
    { id: "inicio", label: "nav.home", icon: House, component: HomeScreen },
    { id: "ajustes", label: "nav.settings", icon: Settings, component: SettingsScreen },
  ],
};
