// Ajustes de la tienda. Los valores se validan aquí, en un solo lugar, tanto al
// guardarlos como al leerlos de la base de datos.

import { DEFAULT_THEME, isThemeId, type ThemeId } from "./themes";

export interface Settings {
  /** Nombre de la tienda; vacío mientras no se configure. */
  "store.name": string;
  "ui.theme": ThemeId;
}

export type SettingKey = keyof Settings;

export const DEFAULT_SETTINGS: Settings = {
  "store.name": "",
  "ui.theme": DEFAULT_THEME,
};

export const STORE_NAME_MAX = 60;

export class SettingError extends Error {}

export function isSettingKey(key: unknown): key is SettingKey {
  return typeof key === "string" && Object.hasOwn(DEFAULT_SETTINGS, key);
}

/** Devuelve el valor limpio o lanza SettingError si no es válido. */
export function parseSetting<K extends SettingKey>(key: K, value: unknown): Settings[K] {
  switch (key) {
    case "store.name": {
      if (typeof value !== "string") throw new SettingError("El nombre de la tienda debe ser un texto.");
      const name = value.trim().replace(/\s+/g, " ");
      if (name.length > STORE_NAME_MAX) {
        throw new SettingError(`El nombre de la tienda no puede pasar de ${STORE_NAME_MAX} caracteres.`);
      }
      return name as Settings[K];
    }
    case "ui.theme": {
      if (!isThemeId(value)) throw new SettingError("Ese tema de color no existe.");
      return value as Settings[K];
    }
    default:
      throw new SettingError(`Ajuste desconocido: ${String(key)}`);
  }
}
