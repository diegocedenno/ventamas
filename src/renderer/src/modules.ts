import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { ModuleManifest } from "@shared/modules";

export interface Screen {
  /** Identificador estable de la pantalla, único en toda la aplicación. */
  id: string;
  /** Nombre en el menú. */
  label: string;
  icon: LucideIcon;
  component: ComponentType;
  /** Posición en el menú: menor va más arriba. */
  order: number;
  /** Va al pie del menú, separada de las pantallas de trabajo (Ajustes). */
  footer?: boolean;
}

/** Un bloque que un módulo añade a la pantalla de Ajustes. */
export interface SettingsSection {
  id: string;
  component: ComponentType;
  order: number;
}

/** La parte de un módulo que vive en la interfaz: sus pantallas y su lugar en el menú. */
export interface RendererModule {
  manifest: ModuleManifest;
  screens: readonly Screen[];
  settings?: readonly SettingsSection[];
}
