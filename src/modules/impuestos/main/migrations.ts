import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_impuestos",
    sql: `
      -- Las tasas que puede llevar un producto. Cada venta guarda la tasa con la que se
      -- cobró, así que cambiar una tasa aquí no cambia las ventas ya hechas.
      CREATE TABLE tax_classes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        code TEXT NOT NULL DEFAULT '',
        -- En centésimas de punto: 1600 = 16 %.
        rate INTEGER NOT NULL CHECK (rate BETWEEN 0 AND 10000),
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        position INTEGER NOT NULL
      ) STRICT;

      -- Las tasas del IVA venezolano. Se pueden editar si cambian o si la tienda es de otro país.
      INSERT INTO tax_classes (id, name, code, rate, position) VALUES
        ('general', 'IVA general', 'G', 1600, 1),
        ('reducida', 'IVA reducido', 'R', 800, 2),
        ('exento', 'Exento', 'E', 0, 3);
    `,
  },
];
