import type { ModuleManifest } from "@shared/modules";

// Impuestos: las tasas que la tienda cobra en sus ventas (el IVA en Venezuela) y cómo se
// aplican. Apagado por defecto: una tienda que no desglosa impuestos no ve nada de esto.
export const manifest: ModuleManifest = {
  id: "impuestos",
  depends: ["nucleo"],
};
