import type { LucideIcon } from "lucide-react";
import type { ComponentType } from "react";
import type { ModuleManifest } from "@shared/modules";
import type { Settings } from "@shared/settings";

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
  /** Si se indica, la pantalla solo aparece cuando los ajustes de la tienda lo piden. */
  when?(settings: Settings): boolean;
}

/** Un bloque que un módulo añade a la pantalla de Ajustes. */
export interface SettingsSection {
  id: string;
  /** Nombre del bloque en el índice de Ajustes. */
  label: string;
  component: ComponentType;
  order: number;
}

/**
 * Una pieza que un módulo coloca dentro de la pantalla de otro, en un lugar con nombre.
 * Así un módulo que depende de otro puede ampliarlo sin que el primero lo conozca: la
 * facturación añade su botón a la ventana de una venta, por ejemplo.
 */
export interface SlotPiece {
  /** Lugar donde va: "ventas.sale". */
  slot: string;
  // Cada lugar define las propiedades que entrega a sus piezas.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  component: ComponentType<any>;
  order: number;
}

/** La parte de un módulo que vive en la interfaz: sus pantallas y su lugar en el menú. */
export interface RendererModule {
  manifest: ModuleManifest;
  screens: readonly Screen[];
  settings?: readonly SettingsSection[];
  slots?: readonly SlotPiece[];
}
