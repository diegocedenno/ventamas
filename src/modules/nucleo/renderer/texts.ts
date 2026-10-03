import { createT } from "../../../renderer/src/i18n";

const es = {
  "nav.settings": "Ajustes",
  "settings.title": "Ajustes",
  "settings.store.title": "Tu tienda",
  "settings.store.name": "Nombre de la tienda",
  "settings.store.name.hint": "Aparece en la barra lateral y en los recibos. Máximo {max} caracteres.",
  "settings.store.name.placeholder": "Ej.: Calzados Altamira",
  "settings.save": "Guardar",
  "settings.saved": "Guardado",
  "settings.theme.title": "Color",
  "settings.theme.hint": "Elige el color que más se parezca a tu tienda. Se aplica al instante.",
  "settings.theme.dark": "oscuro",
  "settings.about.title": "Acerca de",
  "settings.about.version": "Versión",
  "settings.about.license": "Licencia",
  "settings.about.license.value": "AGPL-3.0 · software libre y de código abierto",
  "settings.about.data": "Tus datos se guardan en",
  "settings.about.openData": "Abrir carpeta",
} as const;

export const t = createT(es);
