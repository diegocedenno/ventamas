import { immutable } from "../../../main/db/facts";
import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_caja",
    sql: `
      CREATE TABLE payment_methods (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        currency TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('efectivo', 'electronico')),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        position INTEGER NOT NULL
      ) STRICT;

      INSERT INTO payment_methods (id, name, currency, kind, position) VALUES
        ('efectivo-ves', 'Bolívares efectivo', 'VES', 'efectivo', 1),
        ('efectivo-usd', 'Dólares efectivo', 'USD', 'efectivo', 2),
        ('efectivo-eur', 'Euros efectivo', 'EUR', 'efectivo', 3),
        ('punto', 'Punto de venta', 'VES', 'electronico', 4),
        ('pago-movil', 'Pago móvil', 'VES', 'electronico', 5),
        ('transferencia', 'Transferencia', 'VES', 'electronico', 6),
        ('zelle', 'Zelle', 'USD', 'electronico', 7);

      CREATE TABLE cash_sessions (
        id TEXT PRIMARY KEY,
        opened_at TEXT NOT NULL,
        closed_at TEXT,
        note TEXT NOT NULL DEFAULT ''
      ) STRICT;
      -- Solo puede haber una caja abierta a la vez.
      CREATE UNIQUE INDEX cash_sessions_one_open ON cash_sessions ((closed_at IS NULL)) WHERE closed_at IS NULL;

      -- Todo el dinero que entra o sale, por el medio que sea: el fondo de apertura, las
      -- entradas y salidas a mano, los cobros de las ventas y los vueltos.
      CREATE TABLE money_movements (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL REFERENCES cash_sessions (id),
        method_id TEXT NOT NULL REFERENCES payment_methods (id),
        kind TEXT NOT NULL CHECK (kind IN ('apertura', 'entrada', 'salida', 'cobro', 'vuelto')),
        -- Con signo (lo que sale es negativo), en unidad mínima de su moneda.
        amount INTEGER NOT NULL CHECK (amount <> 0),
        currency TEXT NOT NULL,
        -- Tasa de esa moneda frente a la moneda local en ese momento; NULL si es la local.
        rate INTEGER,
        -- Venta que lo originó, y su equivalente en la moneda de la venta.
        sale_id TEXT,
        base_amount INTEGER,
        base_currency TEXT,
        -- Motivo de la entrada o salida, o referencia del pago.
        note TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX money_movements_session ON money_movements (session_id);
      CREATE INDEX money_movements_sale ON money_movements (sale_id) WHERE sale_id IS NOT NULL;
      ${immutable("money_movements", "Los movimientos de dinero")}

      -- El conteo del cierre: lo esperado queda guardado junto a lo contado.
      CREATE TABLE cash_counts (
        session_id TEXT NOT NULL REFERENCES cash_sessions (id),
        method_id TEXT NOT NULL REFERENCES payment_methods (id),
        expected INTEGER NOT NULL,
        counted INTEGER NOT NULL,
        PRIMARY KEY (session_id, method_id)
      ) STRICT, WITHOUT ROWID;
      ${immutable("cash_counts", "Los conteos de cierre")}
    `,
  },
];
