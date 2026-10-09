import type { ModuleManifest } from "@shared/modules";

// Facturación (Venezuela): apagada por defecto. Ventamas no convierte un documento en
// factura por sí solo: o bien anota la factura que la tienda emite por otro medio (máquina
// fiscal, talonario, imprenta digital), o bien la imprime sobre formas libres de una
// imprenta autorizada, para quien no está obligado a máquina fiscal.
// El porqué está en docs/decisiones/0008-facturacion.md.
export const manifest: ModuleManifest = {
  id: "facturacion",
  depends: ["nucleo", "impuestos", "clientes", "ventas"],
};
