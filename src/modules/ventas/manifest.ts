import type { ModuleManifest } from "@shared/modules";

// Ventas: la pantalla de cobro, la venta registrada y su recibo.
export const manifest: ModuleManifest = {
  id: "ventas",
  depends: ["nucleo", "monedas", "impuestos", "inventario", "caja", "clientes"],
};
