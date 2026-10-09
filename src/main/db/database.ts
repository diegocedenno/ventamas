// Base de datos local: un archivo SQLite en la carpeta de datos de la tienda.
// Se usa el SQLite integrado en Node (node:sqlite), sin módulos nativos que compilar.

import { randomUUID } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { normalize } from "@shared/text";

export type Db = DatabaseSync;

export function openDatabase(file: string): Db {
  const db = new DatabaseSync(file);
  // Funciones propias para el SQL de las migraciones, que no puede quitar acentos ni
  // crear identificadores por sí solo.
  db.function("vm_normalize", { deterministic: true }, (text) => normalize(typeof text === "string" ? text : ""));
  db.function("vm_id", () => randomUUID());
  // WAL + synchronous=FULL: una venta confirmada sobrevive a un corte de luz.
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = FULL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
  `);
  return db;
}

/** Ejecuta fn dentro de una transacción: o se guarda todo, o no se guarda nada. */
export function transaction<T>(db: Db, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}
