// Textos del armazón de la aplicación. Cada módulo guarda los suyos en su carpeta.
// Se escriben con palabras de tienda, sin jerga contable.

import { createT } from "./index";

const es = {
  "app.name": "Ventamas",
  "app.skip": "Saltar al contenido",
  "nav.label": "Secciones",
  "store.unnamed": "Tu tienda",
} as const;

export const t = createT(es);
