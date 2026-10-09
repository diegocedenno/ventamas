import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import type { Product } from "../api";
import { migrations } from "./migrations";
import { getProduct, recordSaleStock, saveProduct } from "./products";
import { ean13CheckDigit, inventorySummary, listMovements, moveStock, suggestCode } from "./stock";

let db: Db;
let shoe: Product;

const at = (hour: number) => new Date(2026, 9, 5, hour, 0);

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "inventario", migrations }]);
  shoe = saveProduct(
    db,
    {
      name: "Zapato deportivo",
      kind: "producto",
      category: "Calzado",
      price: 4500,
      cost: 2000,
      option1: "Talla",
      option2: "",
      minStock: 1,
      variants: [
        { value1: "37", value2: "", code: "", stock: 2 },
        { value1: "38", value2: "", code: "", stock: 4 },
      ],
    },
    { currency: "USD" },
    at(8)
  );
});

afterEach(() => db.close());

const v37 = () => shoe.variants[0]!.id;
const v38 = () => shoe.variants[1]!.id;
const stock = () => getProduct(db, shoe.id).variants.map((v) => v.stock);

describe("mover existencias", () => {
  it("una entrada suma piezas", () => {
    const product = moveStock(db, { variantId: v37(), reason: "entrada", quantity: 6, note: "Pedido de octubre" }, at(9));
    expect(product.variants[0]?.stock).toBe(8);
  });

  it("un conteo deja las existencias en lo contado y registra la diferencia", () => {
    moveStock(db, { variantId: v38(), reason: "conteo", quantity: 3, note: "" }, at(9));
    expect(stock()).toEqual([2, 3]);
    expect(listMovements(db, shoe.id)[0]).toMatchObject({ reason: "conteo", quantity: -1, balance: 3, variant: "38" });
  });

  it("un conteo que coincide no registra nada", () => {
    moveStock(db, { variantId: v38(), reason: "conteo", quantity: 4, note: "" }, at(9));
    expect(listMovements(db, shoe.id)).toHaveLength(2);
  });

  it("daño, pérdida y uso propio restan piezas", () => {
    moveStock(db, { variantId: v38(), reason: "dano", quantity: 1, note: "Suela despegada" }, at(9));
    moveStock(db, { variantId: v38(), reason: "perdida", quantity: 1, note: "" }, at(10));
    moveStock(db, { variantId: v38(), reason: "uso", quantity: 1, note: "Muestra de vitrina" }, at(11));
    expect(stock()).toEqual([2, 1]);
  });

  it("valida la cantidad, el motivo y la pieza", () => {
    expect(() => moveStock(db, { variantId: v37(), reason: "entrada", quantity: 0, note: "" })).toThrow(/mayor que cero/);
    expect(() => moveStock(db, { variantId: v37(), reason: "dano", quantity: -2, note: "" })).toThrow(UserError);
    expect(() => moveStock(db, { variantId: v37(), reason: "venta", quantity: 1, note: "" })).toThrow(TypeError);
    expect(() => moveStock(db, { variantId: "no-existe", reason: "entrada", quantity: 1, note: "" })).toThrow(/ya no existe/);
    expect(() => moveStock(db, { variantId: v37(), reason: "conteo", quantity: 1, note: "", unitCost: 100 })).toThrow(TypeError);
    expect(stock()).toEqual([2, 4]);
  });

  it("un servicio no admite movimientos", () => {
    const service = saveProduct(
      db,
      { name: "Arreglo", kind: "servicio", category: "", price: 500, cost: null, variants: [{ value1: "", value2: "", code: "", stock: 0 }] },
      { currency: "USD" }
    );
    expect(() => moveStock(db, { variantId: service.variants[0]!.id, reason: "entrada", quantity: 1, note: "" })).toThrow(/no lleva existencias/);
  });
});

describe("costo promedio", () => {
  it("una entrada con costo promedia con lo que había", () => {
    // Había 6 pares a 20,00 y llegan 6 a 26,00: el costo queda en 23,00.
    const product = moveStock(db, { variantId: v37(), reason: "entrada", quantity: 6, note: "", unitCost: 2600 }, at(9));
    expect(product.cost).toBe(2300);
  });

  it("sin costo anterior, toma el de la entrada", () => {
    const plain = saveProduct(
      db,
      { name: "Medias", kind: "producto", category: "", price: 300, cost: null, variants: [{ value1: "", value2: "", code: "", stock: 5 }] },
      { currency: "USD" }
    );
    const product = moveStock(db, { variantId: plain.variants[0]!.id, reason: "entrada", quantity: 10, note: "", unitCost: 120 });
    expect(product.cost).toBe(120);
  });

  it("las piezas en negativo no cuentan como existencia al promediar", () => {
    recordSaleStock(db, "venta-1", [{ variantId: v37(), quantity: 3 }, { variantId: v38(), quantity: 4 }], at(9).toISOString());
    // Quedan −1 y 0: no había nada, así que el costo es el de lo que llega.
    const product = moveStock(db, { variantId: v37(), reason: "entrada", quantity: 5, note: "", unitCost: 3000 }, at(10));
    expect(product.cost).toBe(3000);
  });

  it("una pieza con costo propio promedia solo con las suyas", () => {
    const paint = saveProduct(
      db,
      {
        name: "Pintura",
        kind: "producto",
        category: "",
        price: 1500,
        cost: 900,
        option1: "Presentación",
        variants: [
          { value1: "Cuarto", value2: "", code: "", stock: 4, price: null, cost: null },
          { value1: "Galón", value2: "", code: "", stock: 2, price: 4800, cost: 3000 },
        ],
      },
      { currency: "USD" }
    );
    const after = moveStock(db, { variantId: paint.variants[1]!.id, reason: "entrada", quantity: 2, note: "", unitCost: 3400 });
    expect(after.variants[1]?.cost).toBe(3200);
    expect(after.cost).toBe(900);
  });
});

describe("historial de un producto", () => {
  it("muestra los movimientos del más reciente al más antiguo, con lo que quedó", () => {
    moveStock(db, { variantId: v37(), reason: "entrada", quantity: 3, note: "Pedido" }, at(9));
    recordSaleStock(db, "venta-1", [{ variantId: v37(), quantity: 1 }], at(10).toISOString());
    moveStock(db, { variantId: v38(), reason: "dano", quantity: 1, note: "" }, at(11));

    expect(listMovements(db, shoe.id).map((m) => [m.variant, m.reason, m.quantity, m.balance])).toEqual([
      ["38", "dano", -1, 3],
      ["37", "venta", -1, 4],
      ["37", "entrada", 3, 5],
      ["38", "inicial", 4, 4],
      ["37", "inicial", 2, 2],
    ]);
    expect(listMovements(db, shoe.id)[2]?.note).toBe("Pedido");
    expect(listMovements(db, shoe.id, 2)).toHaveLength(2);
  });
});

describe("cifras del inventario", () => {
  it("cuenta piezas, valor y lo que pide atención", () => {
    saveProduct(
      db,
      { name: "Corte", kind: "servicio", category: "", price: 800, cost: null, variants: [{ value1: "", value2: "", code: "", stock: 0 }] },
      { currency: "USD" }
    );
    saveProduct(
      db,
      { name: "Medias", kind: "producto", category: "", price: 300, cost: null, variants: [{ value1: "", value2: "", code: "", stock: 10 }] },
      { currency: "USD" }
    );
    expect(inventorySummary(db, "USD")).toEqual({
      products: 2,
      services: 1,
      pieces: 16,
      low: 0,
      negative: 0,
      saleValue: 6 * 4500 + 10 * 300,
      costValue: 6 * 2000,
      withoutCost: 1,
      currency: "USD",
    });
  });

  it("una pieza en el mínimo pide reposición y una en negativo, revisión", () => {
    recordSaleStock(db, "venta-1", [{ variantId: v37(), quantity: 3 }], at(9).toISOString());
    const summary = inventorySummary(db, "USD");
    // La talla 37 quedó en −1: no suma piezas ni valor.
    expect(summary).toMatchObject({ pieces: 4, low: 1, negative: 1, saleValue: 4 * 4500 });
  });

  it("una tienda vacía da todo en cero", () => {
    const empty = openDatabase(":memory:");
    runMigrations(empty, [{ module: "inventario", migrations }]);
    expect(inventorySummary(empty, "USD")).toMatchObject({ products: 0, services: 0, pieces: 0, saleValue: 0, costValue: 0 });
    empty.close();
  });
});

describe("códigos propios", () => {
  it("calcula el dígito de control de un EAN-13", () => {
    // 7591234000018 y 4006381333931 son códigos de barras válidos.
    expect(ean13CheckDigit("759123400001")).toBe(8);
    expect(ean13CheckDigit("400638133393")).toBe(1);
    expect(() => ean13CheckDigit("123")).toThrow(RangeError);
  });

  it("propone códigos internos que empiezan por 20 y no se repiten", () => {
    const first = suggestCode(db);
    expect(first).toMatch(/^20\d{11}$/);
    expect(ean13CheckDigit(first.slice(0, 12))).toBe(Number(first[12]));
    expect(first).toBe("2000000000015");

    const second = suggestCode(db, [first]);
    expect(second).not.toBe(first);

    saveProduct(
      db,
      { ...shoe, variants: shoe.variants.map((v, index) => ({ ...v, code: index === 0 ? first : second })) },
      { currency: "USD" }
    );
    const third = suggestCode(db);
    expect([first, second]).not.toContain(third);
    expect(third.slice(0, 12) > second.slice(0, 12)).toBe(true);
  });
});
