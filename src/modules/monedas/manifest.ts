import type { ModuleManifest } from "@shared/modules";

// Monedas: las tasas del día con las que se convierte cada cobro.
export const manifest: ModuleManifest = {
  id: "monedas",
  depends: ["nucleo"],
};
