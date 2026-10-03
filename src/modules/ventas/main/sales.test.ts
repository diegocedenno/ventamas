import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { money } from "@shared/money";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { closeSession, openSession, sessionSummary, setMethodActive } from "../../caja/main/cash";
import type { Product } from "../../inventario/api";
import { getProduct, saveProduct, setProductActive } from "../../inventario/main/products";
import { saveRates } from "../../monedas/main/rates";
import { mainModules } from "../../registry.main";
import type { SaleInput } from "../api";
import { createSale, getSale, salesOfSession } from "./sales";

let db: Db;
let shoe: Product;
let blouse: Product;
let sessionId: string;

const settings = { "store.currency": "USD", "device.prefix": "C01" } as const;
const morning = new Date(2026, 9, 5, 8, 0);
const noon = new Date(2026, 9, 5, 12, 0);

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(
    db,
    mainModules.map((m) => ({ module: m.manifest.id, migrations: m.migrations }))
  );
  saveRates(db, { rates: { USD: 866_560_000, EUR: 973_928_133 }, source: "manual" }, morning);
  shoe = saveProduct(
    db,
    {
      name: "Zapato deportivo",
      category: "Calzado",
      price: 4500,
      cost: null,
      variants: [
        { size: "37", color: "", code: "", stock: 2 },
        { size: "38", color: "", code: "", stock: 3 },
      ],
    },
    "USD",
    morning
  );
  blouse = saveProduct(
    db,
    { name: "Blusa", category: "Ropa", price: 2000, cost: null, variants: [{ size: "M", color: "", code: "", stock: 1 }] },
    "USD",
    morning
  );
  sessionId = openSession(db, { floats: [{ methodId: "efectivo-usd", amount: 2000 }] }, morning).id;
});

afterEach(() => db.close());

const shoe38 = () => shoe.variants[1]!.id;
const blouseM = () => blouse.variants[0]!.id;

// La venta de referencia del PRD: zapatos 38 (45 $) y blusa M (20 $); 40 $ en efectivo
// y el resto por pago móvil.
const reference = (): SaleInput => ({
  lines: [
    { variantId: shoe38(), quantity: 1 },
    { variantId: blouseM(), quantity: 1 },
  ],
  payments: [
    { methodId: "efectivo-usd", amount: 4000, note: "" },
    { methodId: "pago-movil", amount: 2166400, note: "4821" },
  ],
  change: [],
  expectedTotal: 6500,
});

const sell = (input: SaleInput, at = noon) => createSale(db, input, settings, at);
const stock = (product: Product) => getProduct(db, product.id).variants.map((v) => v.stock);
const totalsOf = (methodId: string) => sessionSummary(db, sessionId).totals.find((t) => t.method.id === methodId)!;

describe("registrar una venta", () => {
  it("la venta de referencia queda completa: líneas, pagos, inventario y caja", () => {
    const sale = sell(reference());

    expect(sale).toMatchObject({ number: "C01-000001", currency: "USD", total: 6500, createdAt: noon.toISOString() });
    expect(sale.lines).toEqual([
      { description: "Zapato deportivo · 38", quantity: 1, unitPrice: 4500, total: 4500 },
      { description: "Blusa · M", quantity: 1, unitPrice: 2000, total: 2000 },
    ]);
    expect(sale.payments).toEqual([
      { methodName: "Dólares efectivo", currency: "USD", amount: 4000, note: "" },
      { methodName: "Pago móvil", currency: "VES", amount: 2166400, note: "4821" },
    ]);
    expect(sale.change).toEqual([]);
    expect(sale.rates).toEqual({ pivot: "VES", rates: { USD: 866_560_000, EUR: 973_928_133 } });

    expect(stock(shoe)).toEqual([2, 2]);
    expect(stock(blouse)).toEqual([0]);
    expect(totalsOf("efectivo-usd")).toMatchObject({ opening: 2000, sales: 4000, expected: 6000 });
    expect(totalsOf("pago-movil")).toMatchObject({ sales: 2166400 });
    expect(sessionSummary(db, sessionId)).toMatchObject({ salesCount: 1, salesTotals: [money(6500, "USD")] });
    expect(getSale(db, sale.id)).toEqual(sale);
  });

  it("numera las ventas en orden y las lista de la más reciente a la más antigua", () => {
    sell(reference());
    const second = sell(
      { lines: [{ variantId: shoe38(), quantity: 2 }], payments: [{ methodId: "zelle", amount: 9000, note: "" }], change: [], expectedTotal: 9000 },
      new Date(2026, 9, 5, 13, 0)
    );
    expect(second.number).toBe("C01-000002");
    expect(salesOfSession(db, sessionId).map((s) => [s.number, s.total, s.pieces])).toEqual([
      ["C01-000002", 9000, 2],
      ["C01-000001", 6500, 2],
    ]);
  });

  it("registra el vuelto, incluso en otra moneda", () => {
    // Blusa de 20 $ pagada con 50 €: el vuelto se da en bolívares.
    const paid = 5000;
    const sale = sell({
      lines: [{ variantId: blouseM(), quantity: 1 }],
      payments: [{ methodId: "efectivo-eur", amount: paid, note: "" }],
      // 50 € son 48.696,41 Bs y la blusa 17.331,20 Bs: 31.365,21 Bs de vuelto.
      change: [{ methodId: "efectivo-ves", amount: 3136521 }],
      expectedTotal: 2000,
    });
    expect(sale.change).toEqual([{ methodName: "Bolívares efectivo", currency: "VES", amount: 3136521, note: "" }]);
    expect(totalsOf("efectivo-eur")).toMatchObject({ sales: 5000, expected: 5000 });
    expect(totalsOf("efectivo-ves")).toMatchObject({ change: -3136521, expected: -3136521 });
    expect(sessionSummary(db, sessionId).salesTotals).toEqual([money(2000, "USD")]);
  });

  it("se puede vender sin existencias: la pieza queda en negativo para revisar", () => {
    sell({ lines: [{ variantId: blouseM(), quantity: 3 }], payments: [{ methodId: "efectivo-usd", amount: 6000, note: "" }], change: [], expectedTotal: 6000 });
    expect(stock(blouse)).toEqual([-2]);
  });

  it("guarda la tasa con la que se cobró aunque después cambie", () => {
    const sale = sell(reference());
    saveRates(db, { rates: { USD: 900_000_000, EUR: 990_000_000 }, source: "manual" }, new Date(2026, 9, 5, 15, 0));
    expect(getSale(db, sale.id).rates.rates.USD).toBe(866_560_000);
    expect(
      db.prepare("SELECT rate FROM money_movements WHERE sale_id = ? AND currency = 'USD'").get(sale.id)
    ).toEqual({ rate: 866_560_000 });
    expect(
      db.prepare("SELECT rate FROM money_movements WHERE sale_id = ? AND currency = 'VES'").get(sale.id)
    ).toEqual({ rate: null });
  });

  it("el precio de la venta es el de la base de datos y no cambia si el producto cambia después", () => {
    const sale = sell(reference());
    saveProduct(db, { id: shoe.id, name: "Zapato urbano", category: "Calzado", price: 9900, cost: null, variants: getProduct(db, shoe.id).variants }, "USD");
    expect(getSale(db, sale.id).lines[0]).toMatchObject({ description: "Zapato deportivo · 38", unitPrice: 4500 });
  });
});

describe("lo que impide vender", () => {
  const expectNothingSold = () => {
    expect(salesOfSession(db, sessionId)).toEqual([]);
    expect(stock(shoe)).toEqual([2, 3]);
    expect(totalsOf("efectivo-usd")).toMatchObject({ sales: 0, expected: 2000 });
  };

  it("la caja cerrada", () => {
    closeSession(db, { counts: [{ methodId: "efectivo-usd", counted: 2000 }], note: "" }, morning);
    expect(() => sell(reference())).toThrow(/caja está cerrada/);
  });

  it("la tasa del día sin confirmar", () => {
    expect(() => sell(reference(), new Date(2026, 9, 6, 9, 0))).toThrow(/Confirma la tasa de hoy/);
    expectNothingSold();
  });

  it("que falte dinero o que el vuelto no cuadre", () => {
    const short = reference();
    short.payments = [short.payments[0]!];
    expect(() => sell(short)).toThrow(/falta dinero/);

    const over = reference();
    over.payments[0]!.amount = 5000;
    expect(() => sell(over)).toThrow(/vuelto no cuadra/);

    const tooMuchChange = reference();
    tooMuchChange.payments[0]!.amount = 5000;
    tooMuchChange.change = [{ methodId: "efectivo-usd", amount: 1500 }];
    expect(() => sell(tooMuchChange)).toThrow(/vuelto no cuadra/);
    expectNothingSold();
  });

  it("que el precio haya cambiado mientras se cobraba", () => {
    saveProduct(db, { id: shoe.id, name: shoe.name, category: shoe.category, price: 5000, cost: null, variants: shoe.variants }, "USD");
    expect(() => sell(reference())).toThrow(/precios cambiaron/);
    expectNothingSold();
  });

  it("un producto retirado o un medio de pago desactivado", () => {
    setProductActive(db, blouse.id, false);
    expect(() => sell(reference())).toThrow(/ya no está en venta/);
    setProductActive(db, blouse.id, true);

    setMethodActive(db, "pago-movil", false);
    expect(() => sell(reference())).toThrow(/desactivado/);
    expectNothingSold();
  });

  it("una venta vacía, cantidades imposibles o montos en cero", () => {
    expect(() => sell({ ...reference(), lines: [] })).toThrow(/no tiene productos/);
    expect(() => sell({ ...reference(), lines: [{ variantId: shoe38(), quantity: 0 }] })).toThrow(/cantidad/);
    expect(() => sell({ ...reference(), lines: [{ variantId: shoe38(), quantity: 1.5 }] })).toThrow(TypeError);
    const zero = reference();
    zero.payments[1]!.amount = 0;
    expect(() => sell(zero)).toThrow(UserError);
    expectNothingSold();
  });

  it("si algo falla a mitad, no queda nada a medias", () => {
    // Un medio de pago que no existe hace fallar la venta después de validar las líneas.
    const broken = reference();
    broken.payments[1]!.methodId = "no-existe";
    expect(() => sell(broken)).toThrow(UserError);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sales").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM sale_lines").get()).toEqual({ n: 0 });
    expectNothingSold();
  });
});

describe("las ventas son hechos", () => {
  it("no se pueden modificar ni borrar", () => {
    sell(reference());
    expect(() => db.exec("UPDATE sales SET total = 1")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM sales")).toThrow(/no se borran/);
    expect(() => db.exec("UPDATE sale_lines SET quantity = 9")).toThrow(/no se modifican/);
  });
});
