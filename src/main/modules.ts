import type { ModuleManifest } from "@shared/modules";
import type { Db } from "./db/database";
import type { Migration } from "./db/migrate";

export interface MainContext {
  db: Db;
  /** Registra una función que la interfaz puede llamar por su canal. */
  handle(channel: string, handler: (...args: unknown[]) => unknown): void;
}

/** La parte de un módulo que vive en el proceso principal: sus datos y sus operaciones. */
export interface MainModule {
  manifest: ModuleManifest;
  migrations: readonly Migration[];
  register(context: MainContext): void;
}
