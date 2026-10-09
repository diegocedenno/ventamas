import { UserError } from "@shared/errors";
import { DEFAULT_SETTINGS, isSettingKey, parseSetting, type SettingKey, type Settings } from "@shared/settings";
import { asObject } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";

/** Ajustes guardados sobre los valores por defecto. Un valor dañado se ignora. */
export function readSettings(db: Db): Settings {
  const settings: Settings = { ...DEFAULT_SETTINGS };
  const assign = <K extends SettingKey>(key: K, value: unknown): void => {
    settings[key] = parseSetting(key, value);
  };
  const rows = db.prepare("SELECT key, value FROM settings").all() as Array<{ key: string; value: string }>;
  for (const row of rows) {
    if (!isSettingKey(row.key)) continue;
    try {
      assign(row.key, JSON.parse(row.value));
    } catch {
      // se queda el valor por defecto
    }
  }
  return settings;
}

/** Valida y guarda un ajuste. Lanza SettingError si el valor no es válido. */
export function writeSetting(db: Db, key: unknown, value: unknown, now = new Date()): Settings {
  if (!isSettingKey(key)) throw new TypeError(`Ajuste desconocido: ${String(key)}`);
  const clean = parseSetting(key, value);
  db.prepare(
    `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, JSON.stringify(clean), now.toISOString());
  return readSettings(db);
}

/**
 * Cambia un ajuste desde la pantalla de Ajustes. La moneda de los precios y la marca de
 * "tienda configurada" no se cambian por aquí: se fijan en el asistente de bienvenida.
 */
export function changeSetting(db: Db, key: unknown, value: unknown, now = new Date()): Settings {
  if (key === "setup.done") throw new TypeError("Ese ajuste no se cambia desde la pantalla.");
  if (key === "store.currency" && readSettings(db)["setup.done"]) {
    throw new UserError("La moneda de los precios se elige al configurar la tienda y ya no se cambia: los precios guardados están en ella.");
  }
  return writeSetting(db, key, value, now);
}

/**
 * Termina el asistente de bienvenida: guarda lo elegido y marca la tienda como configurada.
 * Sin datos (el asistente se omitió), deja los valores por defecto.
 */
export function finishSetup(db: Db, value: unknown, now = new Date()): Settings {
  const input = value === undefined || value === null ? {} : asObject(value, "configuración");
  return transaction(db, () => {
    if (readSettings(db)["setup.done"]) throw new UserError("La tienda ya está configurada. Los cambios se hacen en Ajustes.");
    if (input.storeName !== undefined) writeSetting(db, "store.name", input.storeName, now);
    if (input.currency !== undefined) writeSetting(db, "store.currency", input.currency, now);
    if (input.theme !== undefined) writeSetting(db, "ui.theme", input.theme, now);
    return writeSetting(db, "setup.done", true, now);
  });
}
