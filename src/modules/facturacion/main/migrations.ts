import { immutable } from "../../../main/db/facts";
import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_facturas",
    sql: `
      -- Lotes de formas libres: cada pedido a la imprenta trae un rango de números de control.
      CREATE TABLE control_lots (
        id TEXT PRIMARY KEY,
        prefix TEXT NOT NULL DEFAULT '',
        first INTEGER NOT NULL CHECK (first > 0),
        last INTEGER NOT NULL CHECK (last >= first),
        printer TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      ) STRICT;

      -- Una factura: emitida por Ventamas en forma libre, o emitida por otro medio y anotada
      -- aquí. Guarda los datos del cliente y de la tienda tal como salieron en ella.
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        kind TEXT NOT NULL CHECK (kind IN ('emitida', 'externa')),
        sale_id TEXT NOT NULL REFERENCES sales (id),
        series TEXT NOT NULL DEFAULT '',
        -- Correlativo de las emitidas; NULL en las externas.
        seq INTEGER CHECK (seq IS NULL OR seq > 0),
        number TEXT NOT NULL,
        -- Número de control de la hoja; en una externa, el de control o el registro de la máquina.
        control TEXT NOT NULL DEFAULT '',
        customer_name TEXT NOT NULL DEFAULT '',
        customer_doc TEXT NOT NULL DEFAULT '',
        customer_address TEXT NOT NULL DEFAULT '',
        customer_phone TEXT NOT NULL DEFAULT '',
        -- Nombre, RIF, domicilio y régimen de la tienda al emitir (JSON).
        issuer TEXT NOT NULL DEFAULT '{}',
        -- Día de emisión de la tienda (AAAA-MM-DD).
        issued_on TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      -- La numeración es consecutiva y única; un número de control se usa una sola vez.
      CREATE UNIQUE INDEX invoices_number ON invoices (series, seq) WHERE seq IS NOT NULL;
      CREATE UNIQUE INDEX invoices_control ON invoices (control) WHERE kind = 'emitida';
      CREATE INDEX invoices_sale ON invoices (sale_id);
      CREATE INDEX invoices_day ON invoices (issued_on);
      ${immutable("invoices", "Las facturas")}

      -- Una factura no se borra ni se edita: se anula, y queda el porqué.
      CREATE TABLE invoice_voids (
        invoice_id TEXT PRIMARY KEY REFERENCES invoices (id),
        reason TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT, WITHOUT ROWID;
      ${immutable("invoice_voids", "Las anulaciones")}

      -- Hojas del lote que se dañaron sin llegar a ser factura: su número queda inutilizado.
      CREATE TABLE voided_sheets (
        control TEXT PRIMARY KEY,
        reason TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL
      ) STRICT, WITHOUT ROWID;
      ${immutable("voided_sheets", "Las hojas anuladas")}
    `,
  },
];
