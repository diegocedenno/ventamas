import type { Migration } from "../../../main/db/migrate";

// Una migración publicada no se edita: los cambios van siempre en una nueva.
export const migrations: readonly Migration[] = [
  {
    id: "0001_ajustes",
    sql: `
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT, WITHOUT ROWID;
    `,
  },
];
