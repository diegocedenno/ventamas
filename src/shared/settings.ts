// Ajustes de la tienda. Los valores se validan aquí, en un solo lugar, tanto al
// guardarlos como al leerlos de la base de datos.

import { UserError } from "./errors";
import { CURRENCIES, type CurrencyCode } from "./money/money";
import { tidy } from "./text";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

export type ReceiptWidth = 58 | 80;

/** Tamaño de las formas libres en las que se imprime la factura. */
export type InvoicePaper = "carta" | "media-carta";
export const INVOICE_PAPERS: readonly InvoicePaper[] = ["carta", "media-carta"];

/**
 * Cómo se relaciona Ventamas con las facturas de la tienda:
 *  · "off": no las toca; solo emite su recibo no fiscal;
 *  · "externa": la factura se emite por otro medio (máquina fiscal, talonario, imprenta
 *    digital) y en cada venta se anota su número;
 *  · "forma-libre": Ventamas la imprime sobre formas libres de una imprenta autorizada.
 */
export type InvoiceMode = "off" | "externa" | "forma-libre";
export const INVOICE_MODES: readonly InvoiceMode[] = ["off", "externa", "forma-libre"];

/**
 * Cómo tributa la tienda: el contribuyente ordinario cobra el impuesto y lo desglosa; el
 * formal no lo cobra y su factura lo dice.
 */
export type TaxRegime = "ordinario" | "formal";

export interface Settings {
  /** Nombre de la tienda; vacío mientras no se configure. */
  "store.name": string;
  /** Razón social: el nombre legal que va en la factura. */
  "store.legalName": string;
  /** Registro fiscal de la tienda (el RIF en Venezuela). */
  "store.taxId": string;
  "store.address": string;
  "store.phone": string;
  "ui.theme": ThemeId;
  /** Moneda en la que se guardan los precios. */
  "store.currency": CurrencyCode;
  /** Prefijo de los números de venta de este equipo: C01-000001. */
  "device.prefix": string;
  /** Impresora de recibos; vacío para elegirla en cada impresión. */
  "receipt.printer": string;
  /** Ancho del papel del recibo, en milímetros. */
  "receipt.width": ReceiptWidth;
  /** Ya se pasó por el asistente de bienvenida (o se omitió). */
  "setup.done": boolean;
  /** La tienda cobra impuestos y los desglosa en sus ventas. */
  "tax.enabled": boolean;
  /** Los precios ya traen el impuesto dentro; si no, se suma al cobrar. */
  "tax.included": boolean;
  "invoice.mode": InvoiceMode;
  "invoice.regime": TaxRegime;
  "invoice.paper": InvoicePaper;
  /** Serie de las facturas; vacío si no se usan series. */
  "invoice.series": string;
  /** Número de la primera factura que emitirá Ventamas. */
  "invoice.start": number;
  /** Imprimir también el nombre, el RIF y la dirección de la tienda, si la forma no los trae. */
  "invoice.header": boolean;
  /** Espacio que el encabezado preimpreso ocupa arriba de la hoja, en milímetros. */
  "invoice.top": number;
  /** Al cerrar la caja se cuenta sin ver lo esperado; la diferencia aparece después. */
  "cash.blind": boolean;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  "store.name": "",
  "store.legalName": "",
  "store.taxId": "",
  "store.address": "",
  "store.phone": "",
  "ui.theme": DEFAULT_THEME,
  "store.currency": "USD",
  "device.prefix": "C01",
  "receipt.printer": "",
  "receipt.width": 80,
  "setup.done": false,
  "tax.enabled": false,
  "tax.included": true,
  "invoice.mode": "off",
  "invoice.regime": "ordinario",
  "invoice.paper": "carta",
  "invoice.series": "",
  "invoice.start": 1,
  "invoice.header": false,
  "invoice.top": 40,
  "cash.blind": false,
};

export const STORE_NAME_MAX = 60;
export const LEGAL_NAME_MAX = 100;
export const TAX_ID_MAX = 20;
export const ADDRESS_MAX = 200;
export const PHONE_MAX = 40;
export const INVOICE_SERIES_MAX = 4;
export const INVOICE_START_MAX = 99_999_999;
export const INVOICE_TOP_MAX = 120;

export class SettingError extends UserError {}

export function isSettingKey(key: unknown): key is SettingKey {
  return typeof key === "string" && Object.hasOwn(DEFAULT_SETTINGS, key);
}

/** Devuelve el valor limpio o lanza SettingError si no es válido. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const clean = parse(key, value);
  return clean as Settings[K];
}

function text(value: unknown, what: string, max: number): string {
  if (typeof value !== "string") throw new SettingError(`${what} debe ser un texto.`);
  const clean = tidy(value);
  if (clean.length > max) throw new SettingError(`${what} no puede pasar de ${max} caracteres.`);
  return clean;
}

function flag(value: unknown): boolean {
  if (typeof value !== "boolean") throw new SettingError("Ese ajuste solo admite sí o no.");
  return value;
}

function whole(value: unknown, what: string, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < min || value > max) {
    throw new SettingError(`${what} va de ${min} a ${max}.`);
  }
  return value;
}

function parse(key: SettingKey, value: unknown): Settings[SettingKey] {
  switch (key) {
    case "store.name":
      return text(value, "El nombre de la tienda", STORE_NAME_MAX);
    case "store.legalName":
      return text(value, "La razón social", LEGAL_NAME_MAX);
    case "store.taxId":
      return text(value, "El registro fiscal", TAX_ID_MAX).toUpperCase();
    case "store.address":
      return text(value, "La dirección", ADDRESS_MAX);
    case "store.phone":
      return text(value, "El teléfono", PHONE_MAX);
    case "ui.theme":
      if (!isThemeId(value)) throw new SettingError("Ese tema de color no existe.");
      return value;
    case "store.currency":
      if (typeof value !== "string" || !Object.hasOwn(CURRENCIES, value)) {
        throw new SettingError("Esa moneda no existe.");
      }
      return value as CurrencyCode;
    case "device.prefix":
      if (typeof value !== "string" || !/^[A-Z0-9]{1,6}$/.test(value)) {
        throw new SettingError("El prefijo de las ventas lleva de 1 a 6 letras mayúsculas o números.");
      }
      return value;
    case "receipt.printer":
      if (typeof value !== "string" || value.length > 200) throw new SettingError("Esa impresora no es válida.");
      return value;
    case "receipt.width":
      if (value !== 58 && value !== 80) throw new SettingError("El ancho del recibo es de 58 o de 80 milímetros.");
      return value;
    case "setup.done":
    case "tax.enabled":
    case "tax.included":
    case "invoice.header":
    case "cash.blind":
      return flag(value);
    case "invoice.mode":
      if (!INVOICE_MODES.includes(value as InvoiceMode)) throw new SettingError("Esa forma de facturar no existe.");
      return value as InvoiceMode;
    case "invoice.regime":
      if (value !== "ordinario" && value !== "formal") throw new SettingError("Ese régimen no existe.");
      return value;
    case "invoice.paper":
      if (!INVOICE_PAPERS.includes(value as InvoicePaper)) throw new SettingError("Ese papel no existe.");
      return value as InvoicePaper;
    case "invoice.series":
      if (typeof value !== "string" || !/^[A-Z0-9]{0,4}$/.test(value)) {
        throw new SettingError(`La serie lleva hasta ${INVOICE_SERIES_MAX} letras mayúsculas o números.`);
      }
      return value;
    case "invoice.start":
      return whole(value, "El número de la primera factura", 1, INVOICE_START_MAX);
    case "invoice.top":
      return whole(value, "El espacio del encabezado", 0, INVOICE_TOP_MAX);
    default:
      throw new SettingError(`Ajuste desconocido: ${String(key)}`);
  }
}
