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
  {
    // El asistente de bienvenida es para tiendas nuevas. Una tienda que ya guardó algún
    // ajuste, o que ya tiene la tabla de productos, viene de una versión anterior y ya
    // está en marcha: no lo ve.
    id: "0002_bienvenida",
    sql: `
      INSERT INTO settings (key, value, updated_at)
        SELECT 'setup.done', 'true', strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
        WHERE EXISTS (SELECT 1 FROM settings)
           OR EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'products')
        ON CONFLICT (key) DO NOTHING;
    `,
  },
];
