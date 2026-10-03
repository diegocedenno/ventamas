import { createT } from "../../../renderer/src/i18n";

const es = {
  "nav": "Tasas",
  "title": "Tasas del día",
  "lead": "Con estas tasas se convierte cada cobro. Se confirman una vez al día, antes de la primera venta.",
  "confirmed": "Confirmadas hoy, {day}",
  "pending": "Falta confirmar las tasas de hoy",
  "pending.last": "Las últimas son del {day}.",
  "never": "Todavía no hay tasas",
  "field": "Bolívares por {currency}",
  "field.hint": "Hoy vale {value}",
  "field.invalid": "Escribe la tasa como un número, por ejemplo 866,56.",
  "fetch": "Traer tasa oficial",
  "fetching": "Buscando…",
  "fetched": "Tasa oficial del BCV del {date}, tomada de DolarApi. Revísala y confírmala.",
  "confirm": "Confirmar tasas de hoy",
  "update": "Guardar tasas",
  "saved": "Tasas confirmadas",
  "history": "Historial",
  "history.empty": "Aquí aparecerá cada tasa que confirmes.",
  "col.day": "Día",
  "col.time": "Hora",
  "col.currency": "Moneda",
  "col.rate": "Tasa",
  "col.source": "Origen",
  "source.manual": "Escrita a mano",
  "source.bcv": "Oficial BCV",
} as const;

export const t = createT(es);
