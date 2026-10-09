import { describe, expect, it } from "vitest";
import { price, PricingError, type PricingLine } from "./pricing";

const IVA = { id: "general", rate: 1600 };
const REDUCIDO = { id: "reducida", rate: 800 };
const EXENTO = { id: "exento", rate: 0 };

const line = (unitPrice: number, quantity = 1, discount = 0, tax: PricingLine["tax"] = null): PricingLine => ({
  unitPrice,
  quantity,
  discount,
  tax,
});

describe("sin impuestos ni descuentos", () => {
  it("el total es la suma de precio por cantidad", () => {
    const result = price([line(4500), line(2000, 2)], null, true);
    expect(result).toMatchObject({ subtotal: 8500, lineDiscounts: 0, discount: 0, net: 8500, tax: 0, total: 8500, taxes: [] });
    expect(result.lines.map((l) => l.total)).toEqual([4500, 4000]);
  });

  it("una venta vacía vale cero", () => {
    expect(price([], null, true)).toMatchObject({ subtotal: 0, total: 0, lines: [] });
  });
});

describe("descuentos", () => {
  it("el descuento de una línea solo le baja a ella", () => {
    const result = price([line(4500, 2, 900), line(2000)], null, true);
    expect(result.lines.map((l) => l.total)).toEqual([8100, 2000]);
    expect(result).toMatchObject({ subtotal: 11000, lineDiscounts: 900, discount: 0, total: 10100 });
  });

  it("el descuento general en porcentaje se reparte entre las líneas sin perder un céntimo", () => {
    const result = price([line(3333), line(3333), line(3334)], { kind: "percent", value: 1000 }, true);
    expect(result.discount).toBe(1000);
    expect(result.lines.reduce((sum, l) => sum + l.share, 0)).toBe(1000);
    expect(result.lines.reduce((sum, l) => sum + l.total, 0)).toBe(result.total);
    expect(result.total).toBe(9000);
  });

  it("el descuento general se calcula después de los descuentos de línea", () => {
    // 100 − 20 de la línea = 80; el 10 % general son 8.
    const result = price([line(10000, 1, 2000)], { kind: "percent", value: 1000 }, true);
    expect(result).toMatchObject({ lineDiscounts: 2000, discount: 800, total: 7200 });
  });

  it("acepta un descuento general como monto fijo", () => {
    const result = price([line(4500), line(2000)], { kind: "amount", value: 500 }, true);
    expect(result.total).toBe(6000);
    expect(result.lines.map((l) => l.share)).toEqual([346, 154]);
  });

  it("un descuento del 100 % deja la venta en cero", () => {
    expect(price([line(4500)], { kind: "percent", value: 10000 }, true).total).toBe(0);
  });

  it("rechaza descuentos imposibles", () => {
    expect(() => price([line(1000, 1, 1001)], null, true)).toThrow(PricingError);
    expect(() => price([line(1000)], { kind: "amount", value: 1001 }, true)).toThrow(PricingError);
    expect(() => price([line(1000)], { kind: "percent", value: 10001 }, true)).toThrow(PricingError);
    expect(() => price([line(1000, 1, -1)], null, true)).toThrow(PricingError);
  });
});

describe("impuesto incluido en el precio", () => {
  it("saca la base y el impuesto de un precio que ya lo trae", () => {
    // 116,00 con 16 % dentro: base 100,00 e impuesto 16,00.
    const result = price([line(11600, 1, 0, IVA)], null, true);
    expect(result.taxes).toEqual([{ id: "general", rate: 1600, base: 10000, tax: 1600 }]);
    expect(result).toMatchObject({ net: 11600, tax: 1600, total: 11600 });
  });

  it("el total que paga el cliente no cambia: base más impuesto dan el precio", () => {
    for (const amount of [1, 99, 100, 4500, 6599, 123_456]) {
      const result = price([line(amount, 1, 0, IVA)], null, true);
      const tax = result.taxes[0];
      expect((tax?.base ?? 0) + (tax?.tax ?? 0)).toBe(amount);
      expect(result.total).toBe(amount);
    }
  });

  it("calcula el impuesto una vez por tasa y lo reparte entre sus líneas", () => {
    const result = price([line(3333, 1, 0, IVA), line(3333, 1, 0, IVA), line(3334, 1, 0, IVA)], null, true);
    // 100,00 con 16 % dentro: base 86,21 e impuesto 13,79.
    expect(result.taxes).toEqual([{ id: "general", rate: 1600, base: 8621, tax: 1379 }]);
    expect(result.lines.reduce((sum, l) => sum + l.tax, 0)).toBe(1379);
  });

  it("separa cada tasa y deja lo exento sin impuesto", () => {
    const result = price([line(11600, 1, 0, IVA), line(10800, 1, 0, REDUCIDO), line(5000, 1, 0, EXENTO)], null, true);
    expect(result.taxes).toEqual([
      { id: "general", rate: 1600, base: 10000, tax: 1600 },
      { id: "reducida", rate: 800, base: 10000, tax: 800 },
      { id: "exento", rate: 0, base: 5000, tax: 0 },
    ]);
    expect(result).toMatchObject({ tax: 2400, total: 27400 });
  });

  it("el descuento baja la base de cada tasa en proporción", () => {
    const result = price([line(11600, 1, 0, IVA), line(5000, 1, 0, EXENTO)], { kind: "percent", value: 5000 }, true);
    expect(result.taxes).toEqual([
      { id: "general", rate: 1600, base: 5000, tax: 800 },
      { id: "exento", rate: 0, base: 2500, tax: 0 },
    ]);
    expect(result.total).toBe(8300);
  });
});

describe("impuesto sumado al precio", () => {
  it("suma el impuesto al final", () => {
    const result = price([line(10000, 1, 0, IVA), line(5000, 1, 0, EXENTO)], null, false);
    expect(result.taxes).toEqual([
      { id: "general", rate: 1600, base: 10000, tax: 1600 },
      { id: "exento", rate: 0, base: 5000, tax: 0 },
    ]);
    expect(result).toMatchObject({ net: 15000, tax: 1600, total: 16600 });
  });

  it("redondea el impuesto una sola vez, sobre el total de la tasa", () => {
    // Tres líneas de 0,33: por separado darían 0,05 cada una (0,15); juntas, 0,99 × 16 % = 0,16.
    const result = price([line(33, 1, 0, IVA), line(33, 1, 0, IVA), line(33, 1, 0, IVA)], null, false);
    expect(result.tax).toBe(16);
    expect(result.lines.reduce((sum, l) => sum + l.tax, 0)).toBe(16);
    expect(result.total).toBe(115);
  });
});

describe("datos imposibles", () => {
  it("rechaza precios, cantidades y tasas fuera de rango", () => {
    expect(() => price([line(-1)], null, true)).toThrow(PricingError);
    expect(() => price([line(100, 0)], null, true)).toThrow(PricingError);
    expect(() => price([line(100, 1.5)], null, true)).toThrow(PricingError);
    expect(() => price([line(100, 1, 0, { id: "x", rate: 10001 })], null, true)).toThrow(PricingError);
  });
});
