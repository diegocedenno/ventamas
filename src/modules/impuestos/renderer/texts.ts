import { createT } from "../../../renderer/src/i18n";

const es = {
  "settings.title": "Impuestos",
  "settings.hint":
    "Actívalo si cobras IVA y necesitas verlo desglosado en tus ventas. Si no, déjalo apagado: los precios se cobran tal cual y los recibos no mencionan impuestos.",
  "settings.enabled": "Desglosar el impuesto en las ventas",
  "settings.included": "¿Cómo están escritos tus precios?",
  "settings.included.yes": "Ya incluyen el impuesto",
  "settings.included.no": "El impuesto se suma al cobrar",
  "settings.included.yes.hint": "El cliente paga el precio marcado. El recibo muestra cuánto de ese precio es impuesto.",
  "settings.included.no.hint": "Al cobrar se suma el impuesto al precio marcado.",
  "settings.rates": "Tasas",
  "settings.rates.hint": "Cada producto lleva una de estas tasas; la eliges al crearlo. Cambiar una tasa no cambia las ventas ya hechas.",
  "col.name": "Impuesto",
  "col.code": "Letra",
  "col.rate": "Tasa",
  "col.active": "En uso",
  "edit": "Editar",
  "add": "Añadir tasa",
  "editor.new": "Nueva tasa",
  "editor.edit": "Editar tasa",
  "name": "Nombre",
  "name.placeholder": "Ej.: IVA general",
  "name.required": "Escribe el nombre del impuesto.",
  "code": "Letra en el recibo",
  "code.hint": "Una letra corta que marca cada producto: G, R, E.",
  "rate": "Tasa (%)",
  "rate.invalid": "Escribe la tasa como un número entre 0 y 100, por ejemplo 16 o 12,5.",
  "active": "En uso",
  "active.hint": "Una tasa fuera de uso no se ofrece al crear productos.",
  "save": "Guardar",
  "cancel": "Cancelar",
  "inactive": "Fuera de uso",
} as const;

export const t = createT(es);
