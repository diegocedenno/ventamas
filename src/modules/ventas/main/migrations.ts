import { immutable } from "../../../main/db/facts";
import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_ventas",
    sql: `
      CREATE TABLE sales (
        id TEXT PRIMARY KEY,
        -- Número visible: prefijo del equipo y correlativo (C01-000012).
        prefix TEXT NOT NULL,
        seq INTEGER NOT NULL CHECK (seq > 0),
        session_id TEXT NOT NULL REFERENCES cash_sessions (id),
        currency TEXT NOT NULL,
        total INTEGER NOT NULL CHECK (total >= 0),
        -- Las tasas con las que se cobró, tal como estaban (JSON).
        rates TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (prefix, seq)
      ) STRICT;
      CREATE INDEX sales_session ON sales (session_id);
      ${immutable("sales", "Las ventas")}

      -- Cada línea guarda la descripción y el precio del momento: cambiar el producto
      -- después no cambia las ventas ya hechas.
      CREATE TABLE sale_lines (
        id TEXT PRIMARY KEY,
        sale_id TEXT NOT NULL REFERENCES sales (id),
        variant_id TEXT NOT NULL REFERENCES variants (id),
        description TEXT NOT NULL,
        quantity INTEGER NOT NULL CHECK (quantity > 0),
        unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
        total INTEGER NOT NULL CHECK (total >= 0),
        position INTEGER NOT NULL
      ) STRICT;
      CREATE INDEX sale_lines_sale ON sale_lines (sale_id);
      ${immutable("sale_lines", "Las líneas de venta")}
    `,
  },
];
