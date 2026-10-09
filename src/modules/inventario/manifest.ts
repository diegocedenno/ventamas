import type { ModuleManifest } from "@shared/modules";

// Inventario: los productos y servicios, sus categorías y variantes, y cuántas piezas hay
// de cada uno.
export const manifest: ModuleManifest = {
  id: "inventario",
  depends: ["nucleo", "impuestos"],
};
