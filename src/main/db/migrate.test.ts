import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { backupBeforeUpdate } from "./backup";
import { openDatabase, transaction, type Db } from "./database";
import { NewerDataError, runMigrations, type ModuleMigrations } from "./migrate";

const v1: ModuleMigrations[] = [
  { module: "nucleo", migrations: [{ id: "0001_notas", sql: "CREATE TABLE notas (texto TEXT NOT NULL) STRICT;" }] },
];
const v2: ModuleMigrations[] = [
  {
    module: "nucleo",
    migrations: [...v1[0]!.migrations, { id: "0002_fecha", sql: "ALTER TABLE notas ADD COLUMN fecha TEXT;" }],
  },
  { module: "ventas", migrations: [{ id: "0001_ventas", sql: "CREATE TABLE ventas (id TEXT PRIMARY KEY) STRICT;" }] },
];

let dir: string;
let db: Db;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "ventamas-test-"));
  db = openDatabase(join(dir, "ventamas.db"));
});

afterEach(() => {
  db.close();
  rmSync(dir, { recursive: true, force: true });
});

const tables = () =>
  (db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>).map(
    (row) => row.name
  );

describe("runMigrations", () => {
  it("aplica las migraciones pendientes en orden y las registra", () => {
    expect(runMigrations(db, v2)).toEqual(["nucleo/0001_notas", "nucleo/0002_fecha", "ventas/0001_ventas"]);
    expect(tables()).toEqual(["_migrations", "notas", "ventas"]);
  });

  it("no repite lo ya aplicado", () => {
    runMigrations(db, v2);
    expect(runMigrations(db, v2)).toEqual([]);
  });

  it("actualiza datos de una versión anterior sin perderlos", () => {
    runMigrations(db, v1);
    db.prepare("INSERT INTO notas (texto) VALUES (?)").run("primera venta");

    expect(runMigrations(db, v2)).toEqual(["nucleo/0002_fecha", "ventas/0001_ventas"]);
    expect(db.prepare("SELECT texto, fecha FROM notas").get()).toEqual({ texto: "primera venta", fecha: null });
  });

  it("respalda antes de migrar datos existentes, pero no en una instalación nueva", () => {
    const backup = vi.fn();
    runMigrations(db, v1, { backup });
    expect(backup).not.toHaveBeenCalled();

    runMigrations(db, v2, { backup });
    expect(backup).toHaveBeenCalledTimes(1);

    runMigrations(db, v2, { backup });
    expect(backup).toHaveBeenCalledTimes(1);
  });

  it("si una migración falla, no deja cambios a medias", () => {
    const broken: ModuleMigrations[] = [
      {
        module: "nucleo",
        migrations: [
          ...v1[0]!.migrations,
          { id: "0002_rota", sql: "CREATE TABLE extra (a TEXT) STRICT; INSERT INTO no_existe VALUES (1);" },
        ],
      },
    ];
    expect(() => runMigrations(db, broken)).toThrow(/nucleo\/0002_rota/);
    expect(tables()).toEqual(["_migrations", "notas"]);
    expect(db.prepare("SELECT id FROM _migrations").all()).toEqual([{ id: "0001_notas" }]);
  });

  it("no abre datos creados por una versión más nueva", () => {
    runMigrations(db, v2);
    expect(() => runMigrations(db, v1)).toThrow(NewerDataError);
  });
});

describe("transaction", () => {
  it("deshace todo si algo falla", () => {
    runMigrations(db, v1);
    expect(() =>
      transaction(db, () => {
        db.prepare("INSERT INTO notas (texto) VALUES (?)").run("a medias");
        throw new Error("corte de luz");
      })
    ).toThrow("corte de luz");
    expect(db.prepare("SELECT count(*) AS n FROM notas").get()).toEqual({ n: 0 });
  });
});

describe("backupBeforeUpdate", () => {
  it("guarda una copia que se puede abrir y conserva solo las cinco más recientes", () => {
    runMigrations(db, v1);
    db.prepare("INSERT INTO notas (texto) VALUES (?)").run("dato importante");

    let last = "";
    for (let day = 1; day <= 7; day++) {
      last = backupBeforeUpdate(db, dir, new Date(Date.UTC(2026, 9, day)));
    }

    const files = readdirSync(join(dir, "respaldos"));
    expect(files).toHaveLength(5);
    expect(files.some((name) => name.includes("2026-10-01"))).toBe(false);

    const copy = openDatabase(last);
    expect(copy.prepare("SELECT texto FROM notas").get()).toEqual({ texto: "dato importante" });
    copy.close();
  });
});
