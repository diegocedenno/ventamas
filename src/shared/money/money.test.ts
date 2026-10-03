import { describe, expect, it } from "vitest";
import {
  add,
  compare,
  convert,
  format,
  formatRate,
  money,
  negate,
  rateFromDecimal,
  subtract,
  times,
  type RateTable,
} from "./index";

// Tasas de ejemplo: 866,56 Bs por dólar y 1.012,30 Bs por euro.
const table: RateTable = {
  pivot: "VES",
  rates: { USD: rateFromDecimal("866.56"), EUR: rateFromDecimal("1012.30") },
};

describe("money", () => {
  it("rechaza montos que no son enteros", () => {
    expect(() => money(10.5, "USD")).toThrow(RangeError);
    expect(() => money(Number.NaN, "USD")).toThrow(RangeError);
  });

  it("suma y resta en la misma moneda", () => {
    expect(add(money(4500, "USD"), money(2000, "USD"))).toEqual(money(6500, "USD"));
    expect(subtract(money(6500, "USD"), money(4000, "USD"))).toEqual(money(2500, "USD"));
  });

  it("no mezcla monedas sin convertir", () => {
    expect(() => add(money(100, "USD"), money(100, "VES"))).toThrow(TypeError);
    expect(() => compare(money(100, "USD"), money(100, "EUR"))).toThrow(TypeError);
  });

  it("multiplica precio por cantidad", () => {
    expect(times(money(1999, "USD"), 3)).toEqual(money(5997, "USD"));
    expect(() => times(money(1999, "USD"), 1.5)).toThrow(RangeError);
  });

  it("negar cero no produce cero negativo", () => {
    expect(Object.is(negate(money(0, "USD")).amount, 0)).toBe(true);
    expect(negate(money(250, "USD"))).toEqual(money(-250, "USD"));
  });

  it("formatea con coma decimal y punto de miles", () => {
    expect(format(money(6500, "USD"))).toBe("$ 65,00");
    expect(format(money(5632640, "VES"))).toBe("Bs 56.326,40");
    expect(format(money(-150, "EUR"))).toBe("€ -1,50");
  });
});

describe("tasas", () => {
  it("lee tasas decimales como enteros escalados", () => {
    expect(rateFromDecimal("866.56")).toBe(866_560_000);
    expect(rateFromDecimal("1")).toBe(1_000_000);
    expect(rateFromDecimal("0.000001")).toBe(1);
  });

  it("rechaza tasas mal escritas, en cero o con demasiados decimales", () => {
    for (const bad of ["", "abc", "866,56", "-1", "0", "1.2345678"]) {
      expect(() => rateFromDecimal(bad)).toThrow();
    }
  });

  it("muestra la tasa con coma y sin ceros sobrantes", () => {
    expect(formatRate(rateFromDecimal("866.56"))).toBe("866,56");
    expect(formatRate(rateFromDecimal("866.5612"))).toBe("866,5612");
  });
});

describe("convert", () => {
  it("devuelve el mismo monto si la moneda no cambia", () => {
    const m = money(6500, "USD");
    expect(convert(m, "USD", table)).toBe(m);
  });

  it("convierte dólares a bolívares con la tasa del día", () => {
    // 65,00 $ × 866,56 = 56.326,40 Bs
    expect(convert(money(6500, "USD"), "VES", table)).toEqual(money(5632640, "VES"));
  });

  it("convierte bolívares a dólares redondeando al céntimo", () => {
    // 21.664,00 Bs ÷ 866,56 = 25,00 $
    expect(convert(money(2166400, "VES"), "USD", table)).toEqual(money(2500, "USD"));
    // 1.000,00 Bs ÷ 866,56 = 1,15398... → 1,15 $
    expect(convert(money(100000, "VES"), "USD", table)).toEqual(money(115, "USD"));
  });

  it("los empates se alejan de cero", () => {
    const half: RateTable = { pivot: "VES", rates: { USD: rateFromDecimal("0.5") } };
    // 0,01 $ × 0,5 = 0,005 Bs → 0,01 Bs
    expect(convert(money(1, "USD"), "VES", half)).toEqual(money(1, "VES"));
    expect(convert(money(-1, "USD"), "VES", half)).toEqual(money(-1, "VES"));
  });

  it("cruza euro y dólar por el bolívar con un solo redondeo", () => {
    // 50,00 € × 1.012,30 ÷ 866,56 = 58,4091... → 58,41 $
    expect(convert(money(5000, "EUR"), "USD", table)).toEqual(money(5841, "USD"));
  });

  it("falla si falta la tasa de una moneda", () => {
    const onlyUsd: RateTable = { pivot: "VES", rates: { USD: rateFromDecimal("866.56") } };
    expect(() => convert(money(100, "EUR"), "VES", onlyUsd)).toThrow(/EUR/);
  });

  it("no pierde precisión con montos grandes", () => {
    // 1.000.000,00 $ × 866,56 = 866.560.000,00 Bs
    expect(convert(money(100_000_000, "USD"), "VES", table)).toEqual(money(86_656_000_000, "VES"));
  });

  it("resuelve el cobro mixto de la venta de referencia", () => {
    // Venta de 65 $: la clienta paga 40 $ en efectivo y el resto por pago móvil.
    const total = money(6500, "USD");
    const cash = money(4000, "USD");
    const remaining = subtract(total, cash);
    expect(convert(remaining, "VES", table)).toEqual(money(2166400, "VES"));
  });
});
