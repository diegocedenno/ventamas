import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SettingError } from "@shared/settings";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { migrations } from "./migrations";
import { readSettings, writeSetting } from "./settings";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "nucleo", migrations }]);
});

afterEach(() => db.close());

describe("ajustes", () => {
  it("una tienda nueva arranca con los valores por defecto", () => {
    expect(readSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it("guarda y vuelve a leer el nombre y el tema", () => {
    writeSetting(db, "store.name", "  Calzados   Altamira ");
    const settings = writeSetting(db, "ui.theme", "noche");
    expect(settings).toEqual({ ...DEFAULT_SETTINGS, "store.name": "Calzados Altamira", "ui.theme": "noche" });
    expect(readSettings(db)).toEqual(settings);
  });

  it("guardar dos veces el mismo ajuste lo reemplaza", () => {
    writeSetting(db, "ui.theme", "vino");
    writeSetting(db, "ui.theme", "bosque");
    expect(readSettings(db)["ui.theme"]).toBe("bosque");
    expect(db.prepare("SELECT count(*) AS n FROM settings").get()).toEqual({ n: 1 });
  });

  it("rechaza valores no válidos sin guardar nada", () => {
    expect(() => writeSetting(db, "ui.theme", "fucsia")).toThrow(SettingError);
    expect(() => writeSetting(db, "store.name", "x".repeat(61))).toThrow(SettingError);
    expect(() => writeSetting(db, "store.name", 42)).toThrow(SettingError);
    expect(() => writeSetting(db, "receipt.width", 70)).toThrow(SettingError);
    expect(() => writeSetting(db, "device.prefix", "caja 1")).toThrow(SettingError);
    expect(() => writeSetting(db, "store.currency", "BTC")).toThrow(SettingError);
    expect(() => writeSetting(db, "no.existe", "x")).toThrow(TypeError);
    expect(readSettings(db)).toEqual(DEFAULT_SETTINGS);
  });

  it("ignora valores dañados o desconocidos en la base de datos", () => {
    const insert = db.prepare("INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)");
    insert.run("ui.theme", '"tema-de-otra-version"', "2026-10-03T00:00:00.000Z");
    insert.run("store.name", "{esto no es json", "2026-10-03T00:00:00.000Z");
    insert.run("ajuste.futuro", '"x"', "2026-10-03T00:00:00.000Z");
    expect(readSettings(db)).toEqual(DEFAULT_SETTINGS);
  });
});
