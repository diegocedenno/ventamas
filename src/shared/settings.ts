// Ajustes de la tienda. Los valores se validan aquí, en un solo lugar, tanto al
// guardarlos como al leerlos de la base de datos.

import { UserError } from "./errors";
import { CURRENCIES, type CurrencyCode } from "./money/money";
import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

export type ReceiptWidth = 58 | 80;

export interface Settings {
  /** Nombre de la tienda; vacío mientras no se configure. */
  "store.name": string;
  "ui.theme": ThemeId;
  /** Moneda en la que se guardan los precios. */
  "store.currency": CurrencyCode;
  /** Prefijo de los números de venta de este equipo: C01-000001. */
  "device.prefix": string;
  /** Impresora de recibos; vacío para elegirla en cada impresión. */
  "receipt.printer": string;
  /** Ancho del papel del recibo, en milímetros. */
  "receipt.width": ReceiptWidth;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  "store.name": "",
  "ui.theme": DEFAULT_THEME,
  "store.currency": "USD",
  "device.prefix": "C01",
  "receipt.printer": "",
  "receipt.width": 80,
};

export const STORE_NAME_MAX = 60;

export class SettingError extends UserError {}

export function isSettingKey(key: unknown): key is SettingKey {
  return typeof key === "string" && Object.hasOwn(DEFAULT_SETTINGS, key);
}

/** Devuelve el valor limpio o lanza SettingError si no es válido. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  const clean = parse(key, value);
  return clean as Settings[K];
}

function parse(key: SettingKey, value: unknown): Settings[SettingKey] {
  switch (key) {
    case "store.name": {
      if (typeof value !== "string") throw new SettingError("El nombre de la tienda debe ser un texto.");
      const name = value.trim().replace(/\s+/g, " ");
      if (name.length > STORE_NAME_MAX) {
        throw new SettingError(`El nombre de la tienda no puede pasar de ${STORE_NAME_MAX} caracteres.`);
      }
      return name;
    }
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
    default:
      throw new SettingError(`Ajuste desconocido: ${String(key)}`);
  }
}
