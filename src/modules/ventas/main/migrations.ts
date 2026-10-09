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
  {
    // Cliente, descuentos e impuestos en la venta, y ventas en espera. Las ventas ya
    // hechas quedan como estaban: sin cliente, sin descuento y sin desglose de impuestos.
    id: "0002_cliente_descuentos_impuestos",
    sql: `
      -- El cliente, con el nombre y el documento que tenía al comprar.
      ALTER TABLE sales ADD COLUMN customer_id TEXT REFERENCES customers (id);
      ALTER TABLE sales ADD COLUMN customer_name TEXT NOT NULL DEFAULT '';
      ALTER TABLE sales ADD COLUMN customer_doc TEXT NOT NULL DEFAULT '';
      -- Descuento general de la venta, como monto; si se dio como porcentaje, cuál fue.
      ALTER TABLE sales ADD COLUMN discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0);
      ALTER TABLE sales ADD COLUMN discount_percent INTEGER;
      -- Impuesto total: dentro del total (tax_included = 1) o sumado a las líneas.
      ALTER TABLE sales ADD COLUMN tax INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0);
      ALTER TABLE sales ADD COLUMN tax_included INTEGER NOT NULL DEFAULT 1 CHECK (tax_included IN (0, 1));
      ALTER TABLE sales ADD COLUMN note TEXT NOT NULL DEFAULT '';
      CREATE INDEX sales_created ON sales (created_at);
      CREATE INDEX sales_customer ON sales (customer_id) WHERE customer_id IS NOT NULL;

      ALTER TABLE sale_lines ADD COLUMN kind TEXT NOT NULL DEFAULT 'producto';
      -- Descuento propio de la línea y su parte del descuento general. "total" es lo que
      -- vale la línea después de ambos.
      ALTER TABLE sale_lines ADD COLUMN discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0);
      ALTER TABLE sale_lines ADD COLUMN share INTEGER NOT NULL DEFAULT 0 CHECK (share >= 0);
      -- El impuesto con el que se vendió; vacío y NULL si la venta no desglosa impuestos.
      ALTER TABLE sale_lines ADD COLUMN tax_class TEXT NOT NULL DEFAULT '';
      ALTER TABLE sale_lines ADD COLUMN tax_code TEXT NOT NULL DEFAULT '';
      ALTER TABLE sale_lines ADD COLUMN tax_rate INTEGER;
      ALTER TABLE sale_lines ADD COLUMN tax INTEGER NOT NULL DEFAULT 0 CHECK (tax >= 0);
      -- Lo que costaba la pieza al venderla, para saber después cuánto se ganó.
      ALTER TABLE sale_lines ADD COLUMN unit_cost INTEGER;

      -- El desglose de impuestos de la venta: una fila por tasa.
      CREATE TABLE sale_taxes (
        sale_id TEXT NOT NULL REFERENCES sales (id),
        class_id TEXT NOT NULL,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        rate INTEGER NOT NULL,
        base INTEGER NOT NULL,
        tax INTEGER NOT NULL,
        position INTEGER NOT NULL,
        PRIMARY KEY (sale_id, class_id)
      ) STRICT, WITHOUT ROWID;
      ${immutable("sale_taxes", "Los impuestos de una venta")}

      -- Ventas en espera: no son hechos, se borran al retomarlas o descartarlas.
      CREATE TABLE parked_sales (
        id TEXT PRIMARY KEY,
        label TEXT NOT NULL DEFAULT '',
        -- Líneas, descuento y cliente (JSON).
        data TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
    `,
  },
];
