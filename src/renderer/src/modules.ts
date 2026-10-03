import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { ModuleManifest } from "@shared/modules";
import type { TextKey } from "./i18n/es";

export interface Screen {
  /** Identificador estable de la pantalla, único en toda la aplicación. */
  id: string;
  label: TextKey;
  icon: LucideIcon;
  component: ComponentType;
}

/** La parte de un módulo que vive en la interfaz: sus pantallas y su lugar en el menú. */
export interface RendererModule {
  manifest: ModuleManifest;
  screens: readonly Screen[];
}
