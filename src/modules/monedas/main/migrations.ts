import { immutable } from "../../../main/db/facts";
import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_tasas",
    sql: `
      -- Cada confirmación de tasa es un hecho: la tasa vigente es la más reciente.
      CREATE TABLE exchange_rates (
        id TEXT PRIMARY KEY,
        currency TEXT NOT NULL,
        rate INTEGER NOT NULL CHECK (rate > 0),
        source TEXT NOT NULL CHECK (source IN ('manual', 'bcv')),
        day TEXT NOT NULL,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX exchange_rates_currency ON exchange_rates (currency, created_at);
      ${immutable("exchange_rates", "Las tasas registradas")}
    `,
  },
];
