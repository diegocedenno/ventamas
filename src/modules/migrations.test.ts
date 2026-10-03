// Candado de migraciones: una migración publicada nunca se edita ni se borra, porque ya
// corrió en las tiendas que la tienen instalada. Esta prueba compara cada migración con
// la huella guardada en migrations.lock.json.
//
// Al añadir una migración nueva, registra su huella con:
//   npm run lock-migrations
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../main/db/database";
import { runMigrations } from "../main/db/migrate";
import { readSettings, writeSetting } from "./nucleo/main/settings";
import { mainModules } from "./registry.main";

const lockFile = join(__dirname, "migrations.lock.json");

// La huella ignora espacios y saltos de línea: reformatear el SQL no cambia lo que hace.
const fingerprint = (sql: string): string => createHash("sha256").update(sql.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

const current: Record<string, string> = {};
for (const module of mainModules) {
  for (const migration of module.migrations) current[`${module.manifest.id}/${migration.id}`] = fingerprint(migration.sql);
}

if (process.env.VENTAMAS_LOCK_MIGRATIONS) {
  const locked: Record<string, string> = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};
  // Solo se añaden las nuevas: las ya registradas no se pisan.
  writeFileSync(lockFile, JSON.stringify({ ...current, ...locked }, null, 2) + "\n");
}

const locked: Record<string, string> = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};

describe("migraciones publicadas", () => {
  it("ninguna migración registrada se ha editado ni borrado", () => {
    for (const [key, hash] of Object.entries(locked)) {
      expect(current[key], `La migración ${key} está publicada y no puede cambiar ni desaparecer: crea una nueva.`).toBe(hash);
    }
  });

  it("toda migración está registrada", () => {
    const missing = Object.keys(current).filter((key) => !(key in locked));
    expect(missing, "Migraciones nuevas sin registrar: ejecuta «npm run lock-migrations».").toEqual([]);
  });

  it("los identificadores son únicos y van en orden dentro de cada módulo", () => {
    for (const module of mainModules) {
      const ids = module.migrations.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(ids);
    }
  });
});

describe("actualizar desde una versión anterior", () => {
  it("una tienda de la versión 0.1 conserva sus ajustes al recibir los módulos nuevos", () => {
    const db = openDatabase(":memory:");
    const nucleo = mainModules.filter((m) => m.manifest.id === "nucleo");
    const asList = (modules: typeof mainModules) => modules.map((m) => ({ module: m.manifest.id, migrations: m.migrations }));

    // La versión 0.1 solo tenía el núcleo.
    runMigrations(db, asList(nucleo));
    writeSetting(db, "store.name", "Calzados Altamira");
    writeSetting(db, "ui.theme", "vino");

    let backups = 0;
    const applied = runMigrations(db, asList(mainModules), { backup: () => backups++ });

    expect(backups).toBe(1);
    expect(applied.length).toBeGreaterThan(0);
    expect(applied.every((key) => !key.startsWith("nucleo/"))).toBe(true);
    expect(readSettings(db)).toMatchObject({ "store.name": "Calzados Altamira", "ui.theme": "vino", "store.currency": "USD" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM payment_methods").get()).toEqual({ n: 7 });
    db.close();
  });
});
