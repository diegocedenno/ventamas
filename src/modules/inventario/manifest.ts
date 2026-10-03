import type { ModuleManifest } from "@shared/modules";

// Inventario: los productos, sus tallas y colores, y cuántas piezas hay de cada uno.
export const manifest: ModuleManifest = {
  id: "inventario",
  depends: ["nucleo"],
};
