import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { priceRange, type ProductInput, type VariantInput } from "../api";
import { listCategories } from "./categories";
import { migrations } from "./migrations";
import {
  browseForSale,
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

const piece = (value1: string, value2: string, stock = 0, code = "", price: number | null = null): VariantInput => ({
  value1,
  value2,
  stock,
  code,
  price,
  cost: null,
});

const product = (overrides: Partial<ProductInput>): ProductInput => ({
  name: "Producto",
  kind: "producto",
  category: "",
  price: 1000,
  cost: null,
  option1: "",
  option2: "",
  minStock: null,
  openPrice: false,
  taxClass: "general",
  variants: [piece("", "", 0)],
  ...overrides,
});

const shoe = (overrides: Partial<ProductInput> = {}): ProductInput =>
  product({
    name: "Zapato deportivo",
    category: "Calzado",
    price: 4500,
    cost: 2800,
    option1: "Talla",
    option2: "Color",
    variants: [piece("37", "Negro", 2), piece("38", "Negro", 3, "7591234000018"), piece("38", "Blanco", 1)],
    ...overrides,
  });

const save = (input: ProductInput) => saveProduct(db, input, { currency: "USD" });
const stockOf = (id: string) => Object.fromEntries(getProduct(db, id).variants.map((v) => [`${v.value1} ${v.value2}`.trim(), v.stock]));
const movements = () =>
  db.prepare("SELECT quantity, reason FROM stock_movements ORDER BY rowid").all() as Array<{ quantity: number; reason: string }>;
const names = (filter: Record<string, unknown> = {}) => listProducts(db, filter).map((p) => p.name);

describe("guardar productos", () => {
  it("crea un producto con sus variantes y existencias iniciales", () => {
    const saved = save(shoe());
    expect(saved).toMatchObject({
      name: "Zapato deportivo",
      kind: "producto",
      category: "Calzado",
      price: 4500,
      cost: 2800,
      currency: "USD",
      active: true,
      option1: "Talla",
      option2: "Color",
      minStock: null,
      openPrice: false,
      taxClass: "general",
    });
    expect(saved.variants.map((v) => [v.value1, v.value2, v.stock, v.code])).toEqual([
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

  it("un producto sin variantes tiene una sola pieza y no guarda nombres de variante", () => {
    const saved = save(product({ name: "Medias", option1: "Talla", option2: "Color", variants: [piece("", "", 10)] }));
    expect(saved.variants).toHaveLength(1);
    expect(saved.variants[0]).toMatchObject({ value1: "", value2: "", stock: 10 });
    expect(saved).toMatchObject({ option1: "", option2: "", cost: null });
  });

  it("las variantes pueden llamarse como haga falta: capacidad, presentación, sabor…", () => {
    const phone = save(
      product({
        name: "Teléfono Nova 12",
        category: "Teléfonos",
        price: 18000,
        option1: "Capacidad",
        option2: "Color",
        variants: [piece("128 GB", "Negro", 2), piece("256 GB", "Negro", 1, "", 21000)],
      })
    );
    expect(phone).toMatchObject({ option1: "Capacidad", option2: "Color" });
    expect(phone.variants.map((v) => v.price)).toEqual([null, 21000]);
    expect(priceRange(phone)).toEqual({ min: 18000, max: 21000 });
    expect(getSaleItem(db, phone.variants[1]!.id)).toMatchObject({ description: "Teléfono Nova 12 · 256 GB · Negro", unitPrice: 21000 });
    expect(getSaleItem(db, phone.variants[0]!.id).unitPrice).toBe(18000);
  });

  it("una pieza con el mismo precio que el producto no guarda uno propio", () => {
    const paint = save(
      product({ name: "Pintura", price: 1500, option1: "Presentación", variants: [piece("Cuarto", "", 0, "", 1500), piece("Galón", "", 0, "", 4800)] })
    );
    expect(paint.variants.map((v) => v.price)).toEqual([null, 4800]);
    expect(listProducts(db)[0]).toMatchObject({ price: 1500, priceMax: 4800 });
  });

  it("exige nombre para cada variante que se usa", () => {
    expect(() => save(shoe({ option1: "" }))).toThrow(/primera variante/);
    expect(() => save(shoe({ option2: "" }))).toThrow(/segunda variante/);
    expect(() => save(shoe({ option2: "talla" }))).toThrow(/llamarse igual/);
  });

  it("al editar, las existencias se corrigen con un movimiento de conteo", () => {
    const saved = save(shoe());
    const [first, ...rest] = saved.variants;
    save({ ...shoe(), id: saved.id, price: 4800, variants: [{ ...first!, stock: 5 }, ...rest] });

    expect(getProduct(db, saved.id).price).toBe(4800);
    expect(stockOf(saved.id)).toEqual({ "37 Negro": 5, "38 Negro": 3, "38 Blanco": 1 });
    expect(movements().at(-1)).toEqual({ quantity: 3, reason: "conteo" });
    expect(movements()).toHaveLength(4);
  });

  it("guardar sin cambios no registra movimientos", () => {
    const saved = save(shoe());
    save({ ...shoe(), id: saved.id, variants: saved.variants });
    expect(movements()).toHaveLength(3);
  });

  it("una variante que se quita deja de venderse; si vuelve, recupera sus existencias", () => {
    const saved = save(shoe());
    const without = saved.variants.filter((v) => v.value1 !== "37");
    save({ ...shoe(), id: saved.id, variants: without });
    expect(Object.keys(stockOf(saved.id))).toEqual(["38 Negro", "38 Blanco"]);

    // Se vuelve a escribir "37 negro" a mano, sin identificador y con otra capitalización.
    save({ ...shoe(), id: saved.id, variants: [...without, piece("37", "negro", 2)] });
    expect(stockOf(saved.id)).toEqual({ "38 Negro": 3, "38 Blanco": 1, "37 negro": 2 });
    expect(movements()).toHaveLength(3);
  });

  it("se puede renombrar una variante sin perder su historial", () => {
    const saved = save(shoe());
    const renamed = saved.variants.map((v) => (v.value1 === "37" ? { ...v, value1: "37,5" } : v));
    save({ ...shoe(), id: saved.id, variants: renamed });
    expect(stockOf(saved.id)).toEqual({ "37,5 Negro": 2, "38 Negro": 3, "38 Blanco": 1 });
    expect(getProduct(db, saved.id).variants[0]?.id).toBe(saved.variants[0]?.id);
  });

  it("dos piezas pueden intercambiar sus códigos", () => {
    const saved = save(shoe({ option2: "", variants: [piece("37", "", 0, "A"), piece("38", "", 0, "B")] }));
    const [a, b] = saved.variants;
    save({ ...shoe({ option2: "" }), id: saved.id, variants: [{ ...a!, code: "B" }, { ...b!, code: "A" }] });
    expect(getProduct(db, saved.id).variants.map((v) => v.code)).toEqual(["B", "A"]);
  });

  it("valida nombre, precio, combinaciones y códigos", () => {
    expect(() => save(shoe({ name: "   " }))).toThrow(/Falta el nombre/);
    expect(() => save(shoe({ name: "x".repeat(81) }))).toThrow(/80 caracteres/);
    expect(() => save(shoe({ price: -1 }))).toThrow(/precio/);
    expect(() => save(shoe({ cost: -1 }))).toThrow(/costo/);
    expect(() => save(shoe({ minStock: -1 }))).toThrow(/existencia mínima/);
    expect(() => save(shoe({ variants: [] }))).toThrow(/al menos una pieza/);
    expect(() => save(shoe({ variants: [piece("38", "Negro"), piece("38", "negro")] }))).toThrow(/repetida/);
    expect(() => save(shoe({ variants: [piece("37", "", 0, "X"), piece("38", "", 0, "X")] }))).toThrow(/repetido/);
    expect(() => save(shoe({ variants: [piece("37", "", 0, "", -5)] }))).toThrow(/precio/);
    expect(() => save(shoe({ price: 45.5 }))).toThrow(TypeError);
    expect(listProducts(db)).toEqual([]);
  });

  it("comprueba que el impuesto exista cuando se le dice cómo", () => {
    const options = { currency: "USD" as const, isTaxClass: (id: string) => id === "general" || id === "exento" };
    expect(saveProduct(db, shoe({ taxClass: "exento" }), options).taxClass).toBe("exento");
    expect(() => saveProduct(db, shoe({ name: "Otro", taxClass: "inventado", variants: [piece("", "")] }), options)).toThrow(/impuesto/);
  });

  it("un código no puede estar en dos productos", () => {
    save(shoe());
    expect(() => save(product({ name: "Sandalia", price: 2000, variants: [piece("", "", 0, "7591234000018")] }))).toThrow(
      /ya lo usa «Zapato deportivo»/
    );
    expect(listProducts(db)).toHaveLength(1);
  });

  it("editar un producto que no existe avisa con claridad", () => {
    expect(() => save({ ...shoe(), id: "no-existe" })).toThrow(UserError);
  });
});

describe("servicios", () => {
  const haircut = (overrides: Partial<ProductInput> = {}): ProductInput =>
    product({ name: "Corte de caballero", kind: "servicio", category: "Cortes de cabello", price: 800, variants: [piece("", "", 0)], ...overrides });

  it("un servicio no lleva existencias ni movimientos", () => {
    const saved = save(haircut({ variants: [piece("", "", 25)], minStock: 3 }));
    expect(saved).toMatchObject({ kind: "servicio", minStock: null });
    expect(saved.variants).toHaveLength(1);
    expect(saved.variants[0]?.stock).toBe(0);
    expect(movements()).toEqual([]);

    recordSaleStock(db, "venta-1", [{ variantId: saved.variants[0]!.id, quantity: 2, kind: "servicio" }], "2026-10-05T14:00:00.000Z");
    expect(movements()).toEqual([]);
    expect(listProducts(db)[0]).toMatchObject({ kind: "servicio", stock: 0, needsReview: false, low: 0 });
  });

  it("un servicio puede tener modalidades, cada una con su precio y sin existencias", () => {
    const cut = save(
      haircut({ name: "Corte", option1: "Para", variants: [piece("Caballero", "", 9), piece("Dama", "", 0, "", 1500), piece("Niño", "", 0, "", 600)] })
    );
    expect(cut).toMatchObject({ kind: "servicio", option1: "Para" });
    expect(cut.variants.map((v) => [v.value1, v.price, v.stock])).toEqual([
      ["Caballero", null, 0],
      ["Dama", 1500, 0],
      ["Niño", 600, 0],
    ]);
    expect(movements()).toEqual([]);
    expect(getSaleItem(db, cut.variants[1]!.id)).toMatchObject({ description: "Corte · Dama", kind: "servicio", unitPrice: 1500 });
  });

  it("puede tener el precio abierto: se escribe al vender", () => {
    const repair = save(haircut({ name: "Reparación", price: 0, openPrice: true }));
    expect(repair.openPrice).toBe(true);
    expect(getSaleItem(db, repair.variants[0]!.id)).toMatchObject({ kind: "servicio", openPrice: true, unitPrice: 0 });
  });

  it("un producto no se convierte en servicio ni al revés", () => {
    const saved = save(haircut());
    expect(() => save({ ...haircut(), id: saved.id, kind: "producto" })).toThrow(/no se convierte/);
  });

  it("crea su categoría como de servicios", () => {
    save(haircut());
    expect(listCategories(db)).toMatchObject([{ name: "Cortes de cabello", kind: "servicio", productCount: 1 }]);
  });
});

describe("categorías de los productos", () => {
  it("una categoría nueva se crea con las variantes del producto que la estrena", () => {
    save(shoe());
    expect(listCategories(db)).toMatchObject([{ name: "Calzado", kind: "producto", option1: "Talla", option2: "Color", productCount: 1 }]);
  });

  it("la misma categoría escrita distinto es una sola", () => {
    save(shoe());
    const other = save(shoe({ name: "Sandalia", category: "  CALZADO ", variants: [piece("36", "Rojo")] }));
    expect(other.category).toBe("Calzado");
    expect(listCategories(db)).toHaveLength(1);
  });

  it("un producto puede quedarse sin categoría", () => {
    const saved = save(shoe());
    const edited = save({ ...shoe({ category: "" }), id: saved.id, variants: saved.variants });
    expect(edited).toMatchObject({ category: "", categoryId: null });
  });
});

describe("lista y búsqueda", () => {
  beforeEach(() => {
    save(shoe());
    save(product({ name: "Blusa manga larga", category: "Ropa de dama", price: 2000, option1: "Talla", variants: [piece("S", "", 4), piece("M", "", 0)] }));
    save(
      product({
        name: "Pantalón de vestir",
        category: "Ropa de caballero",
        price: 3500,
        option1: "Talla",
        option2: "Color",
        variants: [piece("32", "Azul", 1)],
      })
    );
    save(product({ name: "Arreglo de ruedo", kind: "servicio", category: "Arreglos", price: 500 }));
  });

  it("lista en orden alfabético con piezas y existencias totales", () => {
    expect(listProducts(db).map((p) => [p.name, p.variantCount, p.stock])).toEqual([
      ["Arreglo de ruedo", 1, 0],
      ["Blusa manga larga", 2, 4],
      ["Pantalón de vestir", 1, 1],
      ["Zapato deportivo", 3, 6],
    ]);
  });

  it("busca sin importar acentos, mayúsculas ni el orden de las palabras", () => {
    expect(names({ query: "pantalon" })).toEqual(["Pantalón de vestir"]);
    expect(names({ query: "DAMA blusa" })).toEqual(["Blusa manga larga"]);
    expect(names({ query: "ropa" })).toEqual(["Blusa manga larga", "Pantalón de vestir"]);
    expect(names({ query: "100%" })).toEqual([]);
  });

  it("filtra por categoría y por tipo", () => {
    const shoes = listCategories(db).find((category) => category.name === "Calzado")!;
    expect(names({ categoryId: shoes.id })).toEqual(["Zapato deportivo"]);
    expect(names({ kind: "servicio" })).toEqual(["Arreglo de ruedo"]);
    expect(names({ kind: "producto" })).toHaveLength(3);
  });

  it("avisa de las piezas en el mínimo o por debajo", () => {
    const blusa = getProduct(db, listProducts(db, { query: "blusa" })[0]!.id);
    save({ ...blusa, minStock: 2, variants: blusa.variants });
    expect(listProducts(db, { query: "blusa" })[0]).toMatchObject({ low: 1 });
    expect(names({ lowOnly: true })).toEqual(["Blusa manga larga"]);

    // Con el mínimo en 4, las dos tallas piden reposición; un servicio nunca.
    save({ ...blusa, minStock: 4, variants: blusa.variants });
    expect(listProducts(db, { query: "blusa" })[0]).toMatchObject({ low: 2 });
    expect(names({ lowOnly: true })).toEqual(["Blusa manga larga"]);
  });

  it("un producto retirado sale de la lista y de la venta, pero no se borra", () => {
    const blusa = listProducts(db, { query: "blusa" })[0]!;
    setProductActive(db, blusa.id, false);
    expect(names()).not.toContain("Blusa manga larga");
    expect(names({ includeInactive: true })).toHaveLength(4);
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
    expect(variant).toMatchObject({ value1: "38", value2: "Negro" });
  });

  it("la cuadrícula de venta muestra los productos de una categoría o todos", () => {
    const shoes = listCategories(db).find((category) => category.name === "Calzado")!;
    expect(browseForSale(db, shoes.id).map((p) => p.name)).toEqual(["Zapato deportivo"]);
    expect(browseForSale(db, null)).toHaveLength(4);
    expect(browseForSale(db, null, 2)).toHaveLength(2);
  });
});

describe("existencias y ventas", () => {
  it("vender descuenta piezas y puede dejar una en negativo, marcada para revisar", () => {
    const saved = save(shoe());
    const white = saved.variants.find((v) => v.value2 === "Blanco")!;
    expect(getSaleItem(db, white.id)).toEqual({
      variantId: white.id,
      description: "Zapato deportivo · 38 · Blanco",
      kind: "producto",
      unitPrice: 4500,
      unitCost: 2800,
      currency: "USD",
      openPrice: false,
      taxClass: "general",
      stock: 1,
    });

    recordSaleStock(db, "venta-1", [{ variantId: white.id, quantity: 2 }], "2026-10-05T14:00:00.000Z");
    expect(stockOf(saved.id)["38 Blanco"]).toBe(-1);
    expect(listProducts(db)[0]).toMatchObject({ stock: 4, needsReview: true });

    // Tras contar, se corrige a lo que hay de verdad.
    save({ ...shoe(), id: saved.id, variants: getProduct(db, saved.id).variants.map((v) => (v.id === white.id ? { ...v, stock: 0 } : v)) });
    expect(listProducts(db)[0]).toMatchObject({ stock: 5, needsReview: false });
  });

  it("los movimientos de inventario no se pueden alterar", () => {
    save(shoe());
    expect(() => db.exec("UPDATE stock_movements SET quantity = 99")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM stock_movements")).toThrow(/no se borran/);
  });
});
