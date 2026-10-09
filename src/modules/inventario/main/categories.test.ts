import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { normalize } from "@shared/text";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { CATEGORY_MAX, MAX_SUGGESTED_VALUES, OPTION_NAME_MAX, VARIANT_TEXT_MAX, type CategoryInput } from "../api";
import { RUBROS, templateOf } from "./catalog";
import { listCategories, listRubros, loadRubro, saveCategory } from "./categories";
import { migrations } from "./migrations";
import { listProducts, saveProduct } from "./products";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "inventario", migrations }]);
});

afterEach(() => db.close());

const category = (overrides: Partial<CategoryInput> = {}): CategoryInput => ({
  name: "Franelas",
  kind: "producto",
  option1: "Talla",
  values1: ["S", "M", "L"],
  option2: "Color",
  values2: ["Negro", "Blanco"],
  active: true,
  ...overrides,
});

describe("el catálogo incluido", () => {
  it("tiene rubros con identificadores y nombres únicos", () => {
    expect(RUBROS.length).toBeGreaterThanOrEqual(15);
    expect(new Set(RUBROS.map((rubro) => rubro.id)).size).toBe(RUBROS.length);
    expect(new Set(RUBROS.map((rubro) => normalize(rubro.name))).size).toBe(RUBROS.length);
    for (const rubro of RUBROS) {
      expect(rubro.id).toMatch(/^[a-z][a-z-]*$/);
      expect(rubro.description.length).toBeGreaterThan(10);
      expect(rubro.categories.length).toBeGreaterThanOrEqual(6);
    }
  });

  it("cada categoría cabe en sus campos y usa como mucho dos variantes", () => {
    for (const rubro of RUBROS) {
      const keys = rubro.categories.map((item) => normalize(item.name));
      expect(new Set(keys).size, `categorías repetidas en ${rubro.id}`).toBe(keys.length);
      for (const item of rubro.categories) {
        const where = `${rubro.id} › ${item.name}`;
        expect(item.name.length, where).toBeLessThanOrEqual(CATEGORY_MAX);
        expect(item.options?.length ?? 0, where).toBeLessThanOrEqual(2);
        const names = (item.options ?? []).map((option) => normalize(option.name));
        expect(new Set(names).size, where).toBe(names.length);
        for (const option of item.options ?? []) {
          expect(option.name.length, where).toBeGreaterThan(0);
          expect(option.name.length, where).toBeLessThanOrEqual(OPTION_NAME_MAX);
          expect(option.values.length, where).toBeLessThanOrEqual(MAX_SUGGESTED_VALUES);
          const values = option.values.map(normalize);
          expect(new Set(values).size, `valores repetidos en ${where} › ${option.name}`).toBe(values.length);
          for (const value of option.values) expect(value.length, `${where} › ${value}`).toBeLessThanOrEqual(VARIANT_TEXT_MAX);
        }
      }
    }
  });

  it("incluye rubros de servicios", () => {
    const services = RUBROS.filter((rubro) => rubro.categories.some((item) => item.kind === "servicio"));
    expect(services.map((rubro) => rubro.id)).toEqual(expect.arrayContaining(["peluqueria", "servicio-tecnico", "costura", "copias", "taller"]));
  });
});

describe("cargar un rubro", () => {
  it("una tienda nueva no tiene categorías ni rubros cargados", () => {
    expect(listCategories(db)).toEqual([]);
    expect(listRubros(db).every((rubro) => !rubro.loaded)).toBe(true);
    expect(listRubros(db)[0]).toMatchObject({ id: "ropa", name: "Ropa y lencería" });
    expect(listRubros(db)[0]?.sample.length).toBeGreaterThan(0);
  });

  it("carga las categorías con su plantilla de variantes", () => {
    const calzado = RUBROS.find((rubro) => rubro.id === "calzado")!;
    const { added, categories } = loadRubro(db, "calzado");
    expect(added).toBe(calzado.categories.length);
    expect(categories).toHaveLength(calzado.categories.length);

    const dama = categories.find((item) => item.name === "Zapatos de dama")!;
    expect(dama).toMatchObject({ kind: "producto", option1: "Talla", option2: "Color", rubro: "calzado", active: true, productCount: 0 });
    expect(dama.values1).toEqual(expect.arrayContaining(["36", "37", "38"]));
    expect(dama.values2).toContain("Negro");
    expect(listRubros(db).find((rubro) => rubro.id === "calzado")?.loaded).toBe(true);
  });

  it("cargar dos veces no duplica nada", () => {
    loadRubro(db, "calzado");
    expect(loadRubro(db, "calzado").added).toBe(0);
    expect(listCategories(db)).toHaveLength(RUBROS.find((rubro) => rubro.id === "calzado")!.categories.length);
  });

  it("respeta lo que la tienda ya tenía y solo completa lo que estaba vacío", () => {
    // "Sandalias" con su propia plantilla, y "Cholas" creada sin variantes.
    saveCategory(db, category({ name: "sandalias", option1: "Número", values1: ["36"], option2: "", values2: [] }));
    saveCategory(db, category({ name: "Cholas", option1: "", values1: [], option2: "", values2: [] }));
    loadRubro(db, "calzado");

    const all = listCategories(db);
    expect(all.find((item) => normalize(item.name) === "sandalias")).toMatchObject({ name: "sandalias", option1: "Número", values1: ["36"] });
    expect(all.find((item) => item.name === "Cholas")).toMatchObject({ option1: "Talla", option2: "Color", rubro: "calzado" });
  });

  it("carga rubros de servicios como categorías de servicio", () => {
    const { categories } = loadRubro(db, "peluqueria");
    expect(categories.find((item) => item.name === "Cortes de cabello")).toMatchObject({ kind: "servicio", option1: "Para", option2: "" });
    expect(categories.find((item) => item.name === "Productos para el cabello")?.kind).toBe("producto");
  });

  it("rechaza un rubro que no está en el catálogo", () => {
    expect(() => loadRubro(db, "inventado")).toThrow(UserError);
  });

  it("la plantilla de una categoría sin variantes queda vacía", () => {
    expect(templateOf({ name: "Varios" })).toEqual({ option1: "", values1: [], option2: "", values2: [] });
  });
});

describe("editar categorías", () => {
  it("crea una categoría propia con sus variantes", () => {
    const [created] = saveCategory(db, category({ values1: [" S ", "s", "M", ""] }));
    expect(created).toMatchObject({ name: "Franelas", option1: "Talla", values1: ["S", "M"], option2: "Color", rubro: "" });
  });

  it("sin primera variante, la segunda pasa a ser la primera", () => {
    const [created] = saveCategory(db, category({ option1: "", values1: [] }));
    expect(created).toMatchObject({ option1: "Color", values1: ["Negro", "Blanco"], option2: "", values2: [] });
  });

  it("una categoría de servicios guarda sus modalidades", () => {
    const [created] = saveCategory(
      db,
      category({ name: "Cortes", kind: "servicio", option1: "Para", values1: ["Caballero", "Dama"], option2: "", values2: [] })
    );
    expect(created).toMatchObject({ kind: "servicio", option1: "Para", values1: ["Caballero", "Dama"], option2: "" });
  });

  it("al renombrarla, sus productos se siguen encontrando por el nombre nuevo", () => {
    saveProduct(
      db,
      { name: "Zapato", kind: "producto", category: "Calzado", price: 100, cost: null, variants: [{ value1: "", value2: "", code: "", stock: 0 }] },
      { currency: "USD" }
    );
    const [calzado] = listCategories(db);
    saveCategory(db, { ...calzado!, name: "Zapatería" });
    expect(listProducts(db, { query: "zapateria" })).toHaveLength(1);
    expect(listProducts(db, { query: "calzado" })).toHaveLength(0);
  });

  it("una categoría oculta sale de la lista, y vuelve si un producto la usa", () => {
    const [created] = saveCategory(db, category());
    saveCategory(db, { ...created!, active: false });
    expect(listCategories(db)).toEqual([]);
    expect(listCategories(db, true)).toHaveLength(1);

    saveProduct(
      db,
      { name: "Franela básica", kind: "producto", category: "franelas", price: 100, cost: null, variants: [{ value1: "", value2: "", code: "", stock: 0 }] },
      { currency: "USD" }
    );
    expect(listCategories(db)).toMatchObject([{ name: "Franelas", active: true, productCount: 1 }]);
  });

  it("rechaza nombres repetidos, variantes sin nombre y valores demasiado largos", () => {
    saveCategory(db, category());
    expect(() => saveCategory(db, category({ name: "FRANELAS" }))).toThrow(/Ya hay una categoría/);
    expect(() => saveCategory(db, category({ name: "" }))).toThrow(UserError);
    expect(() => saveCategory(db, category({ name: "Otra", option2: "", values2: ["Rojo"] }))).toThrow(/segunda variante/);
    expect(() => saveCategory(db, category({ name: "Otra", option2: "talla" }))).toThrow(/llamarse igual/);
    expect(() => saveCategory(db, category({ name: "Otra", values1: ["x".repeat(VARIANT_TEXT_MAX + 1)] }))).toThrow(/demasiado largo/);
    expect(() => saveCategory(db, { ...category(), id: "no-existe", name: "Otra" })).toThrow(/ya no existe/);
    expect(listCategories(db, true)).toHaveLength(1);
  });
});
