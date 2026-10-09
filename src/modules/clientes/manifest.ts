import type { ModuleManifest } from "@shared/modules";

// Clientes: quién compra en la tienda, con los datos que piden un recibo o una factura.
export const manifest: ModuleManifest = {
  id: "clientes",
  depends: ["nucleo"],
};
