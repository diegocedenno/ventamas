import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import type { ProductInput, VariantInput } from "../api";
import { migrations } from "./migrations";
import {
  getProduct,
  getSaleItem,
  listProducts,
  recordSaleStock,
  saveProduct,
  searchForSale,
  setProductActive,
} from "./products";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "inventario", migrations }]);
});

afterEach(() => db.close());

const piece = (size: string, color: string, stock = 0, code = ""): VariantInput => ({ size, color, stock, code });

const shoe = (overrides: Partial<ProductInput> = {}): ProductInput => ({
  name: "Zapato deportivo",
  category: "Calzado",
  price: 4500,
  cost: 2800,
  variants: [piece("37", "Negro", 2), piece("38", "Negro", 3, "7591234000018"), piece("38", "Blanco", 1)],
  ...overrides,
});

const save = (input: ProductInput) => saveProduct(db, input, "USD");
const stockOf = (id: string) => Object.fromEntries(getProduct(db, id).variants.map((v) => [`${v.size} ${v.color}`.trim(), v.stock]));
const movements = () =>
  db.prepare("SELECT quantity, reason FROM stock_movements ORDER BY rowid").all() as Array<{ quantity: number; reason: string }>;

describe("guardar productos", () => {
  it("crea un producto con sus tallas, colores y existencias iniciales", () => {
    const product = save(shoe());
    expect(product).toMatchObject({ name: "Zapato deportivo", category: "Calzado", price: 4500, cost: 2800, currency: "USD", active: true });
    expect(product.variants.map((v) => [v.size, v.color, v.stock, v.code])).toEqual([
      ["37", "Negro", 2, ""],
      ["38", "Negro", 3, "7591234000018"],
      ["38", "Blanco", 1, ""],
    ]);
    expect(movements()).toEqual([
      { quantity: 2, reason: "inicial" },
      { quantity: 3, reason: "inicial" },
      { quantity: 1, reason: "inicial" },
    ]);
  });

  it("un producto sin tallas ni colores tiene una sola pieza", () => {
    const product = save({ name: "Medias", category: "", price: 300, cost: null, variants: [piece("", "", 10)] });
    expect(product.variants).toHaveLength(1);
    expect(product.variants[0]).toMatchObject({ size: "", color: "", stock: 10 });
    expect(product.cost).toBeNull();
  });

  it("al editar, las existencias se corrigen con un movimiento de ajuste", () => {
    const product = save(shoe());
    const [first, ...rest] = product.variants;
    save({ ...shoe(), id: product.id, price: 4800, variants: [{ ...first!, stock: 5 }, ...rest] });

    expect(getProduct(db, product.id).price).toBe(4800);
    expect(stockOf(product.id)).toEqual({ "37 Negro": 5, "38 Negro": 3, "38 Blanco": 1 });
    expect(movements().at(-1)).toEqual({ quantity: 3, reason: "ajuste" });
    expect(movements()).toHaveLength(4);
  });

  it("guardar sin cambios no registra movimientos", () => {
    const product = save(shoe());
    save({ ...shoe(), id: product.id, variants: product.variants });
    expect(movements()).toHaveLength(3);
  });

  it("una talla que se quita deja de venderse; si vuelve, recupera sus existencias", () => {
    const product = save(shoe());
    const without = product.variants.filter((v) => v.size !== "37");
    save({ ...shoe(), id: product.id, variants: without });
    expect(Object.keys(stockOf(product.id))).toEqual(["38 Negro", "38 Blanco"]);

    // Se vuelve a escribir "37 negro" a mano, sin identificador y con otra capitalización.
    save({ ...shoe(), id: product.id, variants: [...without, piece("37", "negro", 2)] });
    expect(stockOf(product.id)).toEqual({ "38 Negro": 3, "38 Blanco": 1, "37 negro": 2 });
    expect(movements()).toHaveLength(3);
  });

  it("se puede renombrar una talla sin perder su historial", () => {
    const product = save(shoe());
    const renamed = product.variants.map((v) => (v.size === "37" ? { ...v, size: "37,5" } : v));
    save({ ...shoe(), id: product.id, variants: renamed });
    expect(stockOf(product.id)).toEqual({ "37,5 Negro": 2, "38 Negro": 3, "38 Blanco": 1 });
    expect(getProduct(db, product.id).variants[0]?.id).toBe(product.variants[0]?.id);
  });

  it("dos piezas pueden intercambiar sus códigos", () => {
    const product = save(shoe({ variants: [piece("37", "", 0, "A"), piece("38", "", 0, "B")] }));
    const [a, b] = product.variants;
    save({ ...shoe(), id: product.id, variants: [{ ...a!, code: "B" }, { ...b!, code: "A" }] });
    expect(getProduct(db, product.id).variants.map((v) => v.code)).toEqual(["B", "A"]);
  });

  it("valida nombre, precio, combinaciones y códigos", () => {
    expect(() => save(shoe({ name: "   " }))).toThrow(/Falta el nombre/);
    expect(() => save(shoe({ name: "x".repeat(81) }))).toThrow(/80 caracteres/);
    expect(() => save(shoe({ price: -1 }))).toThrow(/precio/);
    expect(() => save(shoe({ cost: -1 }))).toThrow(/costo/);
    expect(() => save(shoe({ variants: [] }))).toThrow(/al menos una pieza/);
    expect(() => save(shoe({ variants: [piece("38", "Negro"), piece("38", "negro")] }))).toThrow(/repetida/);
    expect(() => save(shoe({ variants: [piece("37", "", 0, "X"), piece("38", "", 0, "X")] }))).toThrow(/repetido/);
    expect(() => save(shoe({ price: 45.5 }))).toThrow(TypeError);
    expect(listProducts(db)).toEqual([]);
  });

  it("un código no puede estar en dos productos", () => {
    save(shoe());
    expect(() => save({ name: "Sandalia", category: "", price: 2000, cost: null, variants: [piece("", "", 0, "7591234000018")] })).toThrow(
      /ya lo usa «Zapato deportivo»/
    );
    expect(listProducts(db)).toHaveLength(1);
  });

  it("editar un producto que no existe avisa con claridad", () => {
    expect(() => save({ ...shoe(), id: "no-existe" })).toThrow(UserError);
  });
});

describe("lista y búsqueda", () => {
  beforeEach(() => {
    save(shoe());
    save({ name: "Blusa manga larga", category: "Ropa de dama", price: 2000, cost: null, variants: [piece("S", "", 4), piece("M", "", 0)] });
    save({ name: "Pantalón de vestir", category: "Ropa de caballero", price: 3500, cost: null, variants: [piece("32", "Azul", 1)] });
  });

  it("lista en orden alfabético con piezas y existencias totales", () => {
    expect(listProducts(db).map((p) => [p.name, p.variantCount, p.stock])).toEqual([
      ["Blusa manga larga", 2, 4],
      ["Pantalón de vestir", 1, 1],
      ["Zapato deportivo", 3, 6],
    ]);
  });

  it("busca sin importar acentos, mayúsculas ni el orden de las palabras", () => {
    expect(listProducts(db, "pantalon").map((p) => p.name)).toEqual(["Pantalón de vestir"]);
    expect(listProducts(db, "DAMA blusa").map((p) => p.name)).toEqual(["Blusa manga larga"]);
    expect(listProducts(db, "ropa").map((p) => p.name)).toEqual(["Blusa manga larga", "Pantalón de vestir"]);
    expect(listProducts(db, "100%")).toEqual([]);
  });

  it("un producto retirado sale de la lista y de la venta, pero no se borra", () => {
    const blusa = listProducts(db, "blusa")[0]!;
    setProductActive(db, blusa.id, false);
    expect(listProducts(db).map((p) => p.name)).not.toContain("Blusa manga larga");
    expect(listProducts(db, "", true)).toHaveLength(3);
    expect(searchForSale(db, "blusa").products).toEqual([]);
    expect(() => getSaleItem(db, getProduct(db, blusa.id).variants[0]!.id)).toThrow(/ya no está en venta/);

    setProductActive(db, blusa.id, true);
    expect(searchForSale(db, "blusa").products).toHaveLength(1);
  });

  it("el buscador de venta trae las piezas con sus existencias", () => {
    const { products, exact } = searchForSale(db, "zapato");
    expect(exact).toBeNull();
    expect(products).toHaveLength(1);
    expect(products[0]?.variants.map((v) => v.stock)).toEqual([2, 3, 1]);
    expect(searchForSale(db, "  ").products).toEqual([]);
  });

  it("un código de barras exacto identifica la pieza", () => {
    const { products, exact } = searchForSale(db, "7591234000018");
    expect(products.map((p) => p.name)).toEqual(["Zapato deportivo"]);
    const variant = products[0]?.variants.find((v) => v.id === exact?.variantId);
    expect(variant).toMatchObject({ size: "38", color: "Negro" });
  });
});

describe("existencias y ventas", () => {
  it("vender descuenta piezas y puede dejar una en negativo, marcada para revisar", () => {
    const product = save(shoe());
    const white = product.variants.find((v) => v.color === "Blanco")!;
    expect(getSaleItem(db, white.id)).toEqual({
      variantId: white.id,
      description: "Zapato deportivo · 38 · Blanco",
      unitPrice: 4500,
      currency: "USD",
    });

    recordSaleStock(db, "venta-1", [{ variantId: white.id, quantity: 2 }], "2026-10-05T14:00:00.000Z");
    expect(stockOf(product.id)["38 Blanco"]).toBe(-1);
    expect(listProducts(db)[0]).toMatchObject({ stock: 4, needsReview: true });

    // Tras contar, se corrige a lo que hay de verdad.
    save({ ...shoe(), id: product.id, variants: getProduct(db, product.id).variants.map((v) => (v.id === white.id ? { ...v, stock: 0 } : v)) });
    expect(listProducts(db)[0]).toMatchObject({ stock: 5, needsReview: false });
  });

  it("los movimientos de inventario no se pueden alterar", () => {
    save(shoe());
    expect(() => db.exec("UPDATE stock_movements SET quantity = 99")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM stock_movements")).toThrow(/no se borran/);
  });
});
