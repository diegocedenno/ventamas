import { describe, expect, it } from "vitest";
import { money, type RateTable } from "@shared/money";
import type { PaymentMethod } from "../caja/api";
import { lineDiscount, priceCart, proposeChange, toSaleLines, usableDiscount, type CartLine } from "./cart";
import { settle, valueOf } from "./settlement";

const table: RateTable = { pivot: "VES", rates: { USD: 866_560_000, EUR: 973_928_133 } };

const method = (id: string, currency: PaymentMethod["currency"], kind: PaymentMethod["kind"] = "efectivo"): PaymentMethod => ({
  id,
  name: id,
  currency,
  kind,
  active: true,
});
const ves = method("efectivo-ves", "VES");
const usd = method("efectivo-usd", "USD");
const eur = method("efectivo-eur", "EUR");
const movil = method("pago-movil", "VES", "electronico");
const all = [ves, usd, eur, movil];

let nextKey = 1;
const line = (overrides: Partial<CartLine> = {}): CartLine => ({
  key: nextKey++,
  variantId: "v1",
  description: "Zapato · 38",
  kind: "producto",
  unitPrice: 4500,
  openPrice: false,
  taxClass: "general",
  quantity: 1,
  stock: 3,
  discount: null,
  ...overrides,
});

describe("descuento de una línea", () => {
  it("un porcentaje se calcula sobre precio por cantidad", () => {
    expect(lineDiscount(line({ quantity: 2, discount: { kind: "percent", value: 1000 } }))).toBe(900);
    expect(lineDiscount(line({ discount: { kind: "percent", value: 1250 } }))).toBe(563);
  });

  it("un monto es sobre toda la línea y nunca pasa de lo que vale", () => {
    expect(lineDiscount(line({ quantity: 2, discount: { kind: "amount", value: 500 } }))).toBe(500);
    expect(lineDiscount(line({ discount: { kind: "amount", value: 9999 } }))).toBe(4500);
  });

  it("sin descuento es cero", () => {
    expect(lineDiscount(line())).toBe(0);
  });
});

describe("descuento general", () => {
  it("un monto se recorta a lo que queda por cobrar", () => {
    const lines = [line({ discount: { kind: "amount", value: 500 } })];
    expect(usableDiscount(lines, { kind: "amount", value: 9000 })).toEqual({ kind: "amount", value: 4000 });
    expect(usableDiscount(lines, { kind: "amount", value: 0 })).toBeNull();
    expect(usableDiscount([], { kind: "amount", value: 100 })).toBeNull();
  });

  it("un porcentaje no pasa del 100 %", () => {
    expect(usableDiscount([line()], { kind: "percent", value: 20000 })).toEqual({ kind: "percent", value: 10000 });
  });
});

describe("la cuenta en pantalla", () => {
  const noTax = () => null;

  it("suma líneas, descuentos e impuestos como lo hará el registro", () => {
    const lines = [line({ quantity: 2, discount: { kind: "percent", value: 1000 } }), line({ unitPrice: 2000 })];
    const result = priceCart(lines, { kind: "percent", value: 1000 }, noTax, true);
    // 90,00 − 9,00 + 20,00 = 101,00; menos el 10 % general, 90,90.
    expect(result).toMatchObject({ subtotal: 11000, lineDiscounts: 900, discount: 1010, total: 9090 });
  });

  it("desglosa el impuesto con la tasa de cada producto", () => {
    const taxOf = (taxClass: string) => (taxClass === "exento" ? { id: "exento", rate: 0 } : { id: "general", rate: 1600 });
    const result = priceCart([line({ unitPrice: 11600 }), line({ unitPrice: 5000, taxClass: "exento" })], null, taxOf, true);
    expect(result.taxes).toEqual([
      { id: "general", rate: 1600, base: 10000, tax: 1600 },
      { id: "exento", rate: 0, base: 5000, tax: 0 },
    ]);
  });

  it("manda a registrar el descuento como monto y el precio solo si es abierto", () => {
    const lines = [line({ quantity: 2, discount: { kind: "percent", value: 1000 } }), line({ variantId: "v9", unitPrice: 3500, openPrice: true })];
    expect(toSaleLines(lines)).toEqual([
      { variantId: "v1", quantity: 2, discount: 900, price: undefined },
      { variantId: "v9", quantity: 1, discount: 0, price: 3500 },
    ]);
  });
});

describe("vuelto propuesto", () => {
  it("sin vuelto pendiente no propone nada", () => {
    expect(proposeChange(0n, usd, all, "USD", table)).toEqual([]);
  });

  it("si se pagó en bolívares, todo el vuelto va en bolívares", () => {
    // 40.000 Bs por 45 $ (38.995,20 Bs): 1.004,80 Bs de vuelto.
    const value = valueOf(4_000_000, "VES", table) - valueOf(4500, "USD", table);
    expect(proposeChange(value, ves, all, "USD", table)).toEqual([{ method: ves, amount: 100_480 }]);
  });

  it("si se pagó en dólares y el vuelto es entero, va en dólares", () => {
    const value = valueOf(5000, "USD", table) - valueOf(4500, "USD", table);
    expect(proposeChange(value, usd, all, "USD", table)).toEqual([{ method: usd, amount: 500 }]);
  });

  it("los céntimos de dólar se dan en bolívares, porque no circulan monedas", () => {
    // 20 $ por 16,63 $: 3 $ en dólares y los 0,37 $ restantes (320,63 Bs) en bolívares.
    const value = valueOf(2000, "USD", table) - valueOf(1663, "USD", table);
    const parts = proposeChange(value, usd, all, "USD", table);
    expect(parts).toEqual([
      { method: usd, amount: 300 },
      { method: ves, amount: 32_063 },
    ]);
    // Lo propuesto salda la cuenta exacta.
    const result = settle(
      money(1663, "USD"),
      [{ amount: 2000, currency: "USD" }],
      parts.map((part) => ({ amount: part.amount, currency: part.method.currency })),
      table
    );
    expect(result.settled).toBe(true);
  });

  it("un vuelto menor que un dólar va entero en bolívares", () => {
    const value = valueOf(2000, "USD", table) - valueOf(1950, "USD", table);
    expect(proposeChange(value, usd, all, "USD", table)).toEqual([{ method: ves, amount: 43_328 }]);
  });

  it("pagar en euros una venta en dólares reparte el vuelto entre euros enteros y bolívares", () => {
    // 50 € por 20 $: 32 € y el resto en bolívares.
    const value = valueOf(5000, "EUR", table) - valueOf(2000, "USD", table);
    const parts = proposeChange(value, eur, all, "USD", table);
    expect(parts.map((part) => [part.method.id, part.amount])).toEqual([
      ["efectivo-eur", 3200],
      ["efectivo-ves", 19_951],
    ]);
  });

  it("si se pagó con un medio electrónico, el vuelto va en el efectivo de la moneda de los precios", () => {
    const value = valueOf(500, "USD", table);
    expect(proposeChange(value, movil, all, "USD", table)).toEqual([{ method: usd, amount: 500 }]);
  });

  it("sin efectivo en bolívares, la divisa se propone con sus céntimos", () => {
    const value = valueOf(337, "USD", table);
    expect(proposeChange(value, usd, [usd, movil], "USD", table)).toEqual([{ method: usd, amount: 337 }]);
  });

  it("sin ningún efectivo no hay con qué proponer", () => {
    expect(proposeChange(valueOf(500, "USD", table), movil, [movil], "USD", table)).toEqual([]);
  });
});
