import type { ModuleManifest } from "@shared/modules";

// Caja: los medios de pago y el dinero que entra y sale entre la apertura y el cierre.
export const manifest: ModuleManifest = {
  id: "caja",
  depends: ["nucleo"],
};
