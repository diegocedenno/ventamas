import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_clientes",
    sql: `
      CREATE TABLE customers (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        -- Cédula o RIF con su formato; vacío si no se registró.
        doc TEXT NOT NULL DEFAULT '',
        phone TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        address TEXT NOT NULL DEFAULT '',
        note TEXT NOT NULL DEFAULT '',
        -- Un cliente no se borra: sus ventas lo necesitan. Se archiva.
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        -- Nombre sin acentos, y documento y teléfono solo con sus cifras, para buscar.
        search TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;
      -- Dos clientes activos no comparten documento.
      CREATE UNIQUE INDEX customers_doc ON customers (doc) WHERE doc <> '' AND active = 1;
    `,
  },
];
