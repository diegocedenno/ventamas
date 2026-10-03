// Respaldo automático antes de actualizar la estructura de los datos.

import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Db } from "./database";

const PREFIX = "antes-de-actualizar-";
const KEEP = 5;

/** Copia consistente de la base de datos en <carpeta>/respaldos. Devuelve la ruta. */
export function backupBeforeUpdate(db: Db, dataDir: string, now = new Date()): string {
  const dir = join(dataDir, "respaldos");
  mkdirSync(dir, { recursive: true });

  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const file = join(dir, `${PREFIX}${stamp}.db`);
  // VACUUM INTO no admite parámetros; la ruta va como literal con las comillas escapadas.
  db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);

  // Se conservan solo los últimos respaldos de este tipo.
  const old = readdirSync(dir)
    .filter((name) => name.startsWith(PREFIX) && name.endsWith(".db"))
    .sort()
    .reverse()
    .slice(KEEP);
  for (const name of old) rmSync(join(dir, name), { force: true });

  return file;
}
