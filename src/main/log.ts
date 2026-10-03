// Registro de fallos en un archivo de la carpeta de datos, para poder pedirle a una
// persona no técnica "envíame el archivo ventamas.log" cuando algo sale mal.

import { appendFileSync, existsSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

const MAX_BYTES = 1_000_000;

export function createLogger(dataDir: string) {
  const file = join(dataDir, "ventamas.log");

  return function logError(where: string, error: unknown): void {
    const detail = error instanceof Error ? (error.stack ?? error.message) : String(error);
    const line = `${new Date().toISOString()} [${where}] ${detail}\n`;
    console.error(line);
    try {
      // Un solo archivo anterior basta: el registro nunca crece sin límite.
      if (existsSync(file) && statSync(file).size > MAX_BYTES) renameSync(file, file + ".anterior");
      appendFileSync(file, line);
    } catch {
      // Sin disco no hay registro; el fallo original ya salió por consola.
    }
  };
}
