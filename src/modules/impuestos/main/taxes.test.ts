import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { formatTaxRate } from "../api";
import { migrations } from "./migrations";
import { findTaxClass, listTaxClasses, saveTaxClass } from "./taxes";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "impuestos", migrations }]);
});

afterEach(() => db.close());

describe("tasas de impuesto", () => {
  it("una tienda nueva trae las tres tasas del IVA", () => {
    expect(listTaxClasses(db).map((tax) => [tax.id, tax.code, tax.rate, tax.active])).toEqual([
      ["general", "G", 1600, true],
      ["reducida", "R", 800, true],
      ["exento", "E", 0, true],
    ]);
  });

  it("cambia la tasa de un impuesto que ya existe", () => {
    const list = saveTaxClass(db, { id: "general", name: "IVA general", code: "g", rate: 1200, active: true });
    expect(list[0]).toMatchObject({ id: "general", code: "G", rate: 1200 });
    expect(findTaxClass(db, "general")?.rate).toBe(1200);
  });

  it("añade una tasa nueva al final", () => {
    const list = saveTaxClass(db, { name: "Lujo", code: "L", rate: 3100, active: true });
    expect(list).toHaveLength(4);
    expect(list.at(-1)).toMatchObject({ name: "Lujo", rate: 3100 });
  });

  it("rechaza tasas fuera de rango, nombres repetidos y desactivar la general", () => {
    expect(() => saveTaxClass(db, { name: "Raro", code: "", rate: 10001, active: true })).toThrow(UserError);
    expect(() => saveTaxClass(db, { name: "Raro", code: "", rate: -1, active: true })).toThrow(UserError);
    expect(() => saveTaxClass(db, { name: "iva GENERAL", code: "", rate: 100, active: true })).toThrow(UserError);
    expect(() => saveTaxClass(db, { id: "general", name: "IVA general", code: "G", rate: 1600, active: false })).toThrow(UserError);
    expect(() => saveTaxClass(db, { id: "no-existe", name: "Otro", code: "", rate: 100, active: true })).toThrow(UserError);
    expect(listTaxClasses(db)).toHaveLength(3);
  });

  it("escribe la tasa como porcentaje", () => {
    expect(formatTaxRate(1600)).toBe("16 %");
    expect(formatTaxRate(1250)).toBe("12,5 %");
    expect(formatTaxRate(0)).toBe("0 %");
  });
});
