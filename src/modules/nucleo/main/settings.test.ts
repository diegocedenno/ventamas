import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, SettingError } from "@shared/settings";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { migrations } from "./migrations";
import { changeSetting, finishSetup, readSettings, writeSetting } from "./settings";

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

describe("asistente de bienvenida", () => {
  it("guarda lo elegido y marca la tienda como configurada", () => {
    const settings = finishSetup(db, { storeName: " Calzados Altamira ", currency: "VES", theme: "bosque" });
    expect(settings).toMatchObject({ "store.name": "Calzados Altamira", "store.currency": "VES", "ui.theme": "bosque", "setup.done": true });
  });

  it("omitirlo deja los valores por defecto", () => {
    expect(finishSetup(db, undefined)).toEqual({ ...DEFAULT_SETTINGS, "setup.done": true });
  });

  it("solo se pasa una vez, y un dato no válido no deja nada a medias", () => {
    expect(() => finishSetup(db, { storeName: "Mi tienda", currency: "BTC", theme: "bosque" })).toThrow(SettingError);
    expect(readSettings(db)).toEqual(DEFAULT_SETTINGS);
    finishSetup(db, {});
    expect(() => finishSetup(db, { storeName: "Otra" })).toThrow(/ya está configurada/);
  });

  it("la moneda de los precios solo se elige antes de terminar", () => {
    expect(changeSetting(db, "store.currency", "EUR")["store.currency"]).toBe("EUR");
    finishSetup(db, {});
    expect(() => changeSetting(db, "store.currency", "USD")).toThrow(/ya no se cambia/);
    expect(() => changeSetting(db, "setup.done", false)).toThrow(TypeError);
    expect(changeSetting(db, "store.phone", "0212 555 00 11")["store.phone"]).toBe("0212 555 00 11");
  });
});

describe("datos de la tienda y de facturación", () => {
  it("limpia y guarda los datos de la tienda", () => {
    writeSetting(db, "store.legalName", "  Inversiones   Altamira, C.A. ");
    writeSetting(db, "store.taxId", "j-00124134-5");
    const settings = writeSetting(db, "store.address", "Av. Principal, Chacao, Caracas");
    expect(settings).toMatchObject({ "store.legalName": "Inversiones Altamira, C.A.", "store.taxId": "J-00124134-5" });
  });

  it("valida los ajustes de impuestos y facturas", () => {
    expect(writeSetting(db, "tax.enabled", true)["tax.enabled"]).toBe(true);
    expect(writeSetting(db, "invoice.paper", "media-carta")["invoice.paper"]).toBe("media-carta");
    expect(writeSetting(db, "invoice.series", "A")["invoice.series"]).toBe("A");
    expect(() => writeSetting(db, "tax.enabled", "sí")).toThrow(SettingError);
    expect(writeSetting(db, "invoice.mode", "forma-libre")["invoice.mode"]).toBe("forma-libre");
    expect(() => writeSetting(db, "invoice.mode", "fiscal")).toThrow(SettingError);
    expect(() => writeSetting(db, "invoice.paper", "recibo")).toThrow(SettingError);
    expect(() => writeSetting(db, "invoice.series", "serie")).toThrow(SettingError);
    expect(() => writeSetting(db, "invoice.start", 0)).toThrow(SettingError);
    expect(() => writeSetting(db, "invoice.top", 500)).toThrow(SettingError);
    expect(() => writeSetting(db, "invoice.regime", "especial")).toThrow(SettingError);
  });
});
