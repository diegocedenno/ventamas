import type { ModuleManifest } from "@shared/modules";
import type { Db } from "./db/database";
import type { Migration } from "./db/migrate";

export type Handler = (...args: unknown[]) => unknown;

export interface MainContext {
  db: Db;
  /** Carpeta de datos de la tienda. */
  dataDir: string;
  /** Carpeta donde van los archivos que la persona pide guardar (recibos, libros), a la vista en Documentos. */
  documentsDir: string;
  /**
   * Registra una operación que la interfaz puede llamar por su canal. Si la operación
   * lanza un UserError, su mensaje llega a la persona; cualquier otro error se anota en
   * el registro y la persona ve un mensaje genérico.
   */
  handle(channel: string, handler: Handler): void;
}

/** La parte de un módulo que vive en el proceso principal: sus datos y sus operaciones. */
export interface MainModule {
  manifest: ModuleManifest;
  migrations: readonly Migration[];
  register(context: MainContext): void;
}
