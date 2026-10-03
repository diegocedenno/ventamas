// Migraciones: los cambios de estructura de la base de datos, en orden y sin vuelta atrás.
//
// Reglas de compatibilidad (docs/PRD.md, apartado 9):
//   · una migración publicada nunca se edita ni se borra; los cambios van en una nueva;
//   · cada versión abre los datos de cualquier versión anterior y los migra sola;
//   · antes de migrar datos existentes se guarda un respaldo;
//   · datos creados por una versión más nueva no se abren con una más vieja.

import { transaction, type Db } from "./database";

export interface Migration {
  /** Nombre estable y ordenable: "0001_ajustes". */
  id: string;
  sql: string;
}

export interface ModuleMigrations {
  module: string;
  migrations: readonly Migration[];
}

export interface MigrateOptions {
  /** Se llama una vez, antes de tocar una base de datos que ya tenía datos. */
  backup?: () => void;
  now?: () => Date;
}

export class NewerDataError extends Error {
  constructor() {
    super(
      "Estos datos fueron creados con una versión más nueva de Ventamas. " +
        "Instala la última versión para abrirlos."
    );
  }
}

export function runMigrations(db: Db, modules: readonly ModuleMigrations[], options: MigrateOptions = {}): string[] {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      module TEXT NOT NULL,
      id TEXT NOT NULL,
      applied_at TEXT NOT NULL,
      PRIMARY KEY (module, id)
    ) STRICT, WITHOUT ROWID;
  `);

  const rows = db.prepare("SELECT module, id FROM _migrations").all() as Array<{ module: string; id: string }>;
  const applied = new Set(rows.map((row) => `${row.module}/${row.id}`));

  const known = new Set(modules.flatMap((m) => m.migrations.map((migration) => `${m.module}/${migration.id}`)));
  for (const key of applied) {
    if (!known.has(key)) throw new NewerDataError();
  }

  const pending = modules.flatMap((m) =>
    m.migrations
      .filter((migration) => !applied.has(`${m.module}/${migration.id}`))
      .map((migration) => ({ module: m.module, migration }))
  );
  if (pending.length === 0) return [];

  if (applied.size > 0) options.backup?.();

  const now = options.now ?? (() => new Date());
  const record = db.prepare("INSERT INTO _migrations (module, id, applied_at) VALUES (?, ?, ?)");
  const done: string[] = [];

  for (const { module, migration } of pending) {
    const key = `${module}/${migration.id}`;
    try {
      transaction(db, () => {
        db.exec(migration.sql);
        record.run(module, migration.id, now().toISOString());
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new Error(`No se pudo aplicar la migración ${key}: ${reason}`, { cause: error });
    }
    done.push(key);
  }
  return done;
}
