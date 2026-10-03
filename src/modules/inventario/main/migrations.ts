import { immutable } from "../../../main/db/facts";
import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_productos",
    sql: `
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL CHECK (price >= 0),
        cost INTEGER CHECK (cost IS NULL OR cost >= 0),
        currency TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        -- Nombre y categoría en minúsculas y sin acentos, para buscar.
        search TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      -- Una pieza vendible: el producto en una talla y un color. Un producto sin tallas
      -- ni colores tiene una sola, con ambos vacíos.
      CREATE TABLE variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products (id),
        size TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        code TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0,
        -- Talla y color normalizados: "negro" y "Negro" son la misma pieza.
        key TEXT NOT NULL,
        UNIQUE (product_id, key)
      ) STRICT;
      CREATE UNIQUE INDEX variants_code ON variants (code) WHERE code <> '' AND active = 1;

      -- Las existencias no son un campo: son la suma de estos movimientos.
      CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY,
        variant_id TEXT NOT NULL REFERENCES variants (id),
        quantity INTEGER NOT NULL CHECK (quantity <> 0),
        reason TEXT NOT NULL CHECK (reason IN ('inicial', 'ajuste', 'venta')),
        -- Hecho que lo originó (la venta), si lo hay.
        reference TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX stock_movements_variant ON stock_movements (variant_id);
      ${immutable("stock_movements", "Los movimientos de inventario")}
    `,
  },
];
