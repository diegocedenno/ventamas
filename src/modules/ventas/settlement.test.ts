import { describe, expect, it } from "vitest";
import { money, rateFromDecimal, type RateTable } from "@shared/money";
import { amountIn, settle, valueOf } from "./settlement";

const table: RateTable = {
  pivot: "VES",
  rates: { USD: rateFromDecimal("866.56"), EUR: rateFromDecimal("973.928133") },
};
const total = money(6500, "USD");
const usd = (amount: number) => ({ currency: "USD" as const, amount });
const ves = (amount: number) => ({ currency: "VES" as const, amount });
const eur = (amount: number) => ({ currency: "EUR" as const, amount });

describe("valor exacto", () => {
  it("un monto vale lo mismo expresado en su propia moneda", () => {
    expect(amountIn(valueOf(6500, "USD", table), "USD", table)).toBe(6500);
    expect(amountIn(valueOf(123456, "VES", table), "VES", table)).toBe(123456);
  });

  it("convierte entre monedas redondeando una sola vez", () => {
    expect(amountIn(valueOf(6500, "USD", table), "VES", table)).toBe(5632640);
    expect(amountIn(valueOf(2166400, "VES", table), "USD", table)).toBe(2500);
    expect(amountIn(valueOf(5000, "EUR", table), "USD", table)).toBe(5620);
    expect(amountIn(-valueOf(150, "USD", table), "USD", table)).toBe(-150);
    expect(Object.is(amountIn(0n, "USD", table), 0)).toBe(true);
  });

  it("falla si falta la tasa", () => {
    expect(() => valueOf(100, "EUR", { pivot: "VES", rates: {} })).toThrow(/EUR/);
  });
});

describe("settle", () => {
  it("sin pagos, falta todo", () => {
    expect(settle(total, [], [], table)).toMatchObject({ due: 6500, changeDue: 0, settled: false });
  });

  it("la venta de referencia: 40 $ en efectivo y el resto por pago móvil", () => {
    const partial = settle(total, [usd(4000)], [], table);
    expect(partial).toMatchObject({ due: 2500, settled: false });
    expect(amountIn(partial.dueValue, "VES", table)).toBe(2166400);

    const done = settle(total, [usd(4000), ves(2166400)], [], table);
    expect(done.payments.map((p) => p.base)).toEqual([4000, 2500]);
    expect(done).toMatchObject({ due: 0, changeDue: 0, settled: true });
  });

  it("pagar de más en bolívares deja el vuelto exacto en bolívares", () => {
    // Algo de 45 $ son 38.995,20 Bs. Con 40.000 Bs, el vuelto es 1.004,80 Bs: la resta de siempre.
    const result = settle(money(4500, "USD"), [ves(4000000)], [], table);
    expect(result.due).toBe(0);
    expect(amountIn(result.changeValue, "VES", table)).toBe(100480);
    expect(amountIn(result.changeValue, "USD", table)).toBe(116);

    const done = settle(money(4500, "USD"), [ves(4000000)], [ves(100480)], table);
    expect(done).toMatchObject({ changeDue: 0, settled: true });
    // En la moneda de la venta, lo cobrado menos el vuelto da el total.
    expect(done.payments[0]!.base - done.change[0]!.base).toBe(4500);
  });

  it("un pago exacto en otra moneda salda sin dejar céntimos sueltos", () => {
    // 65 $ son 57,83 €.
    const exact = amountIn(valueOf(6500, "USD", table), "EUR", table);
    expect(exact).toBe(5783);
    const done = settle(total, [eur(exact)], [], table);
    expect(done).toMatchObject({ due: 0, changeDue: 0, settled: true });
    expect(done.payments[0]?.base).toBe(6500);
    // Diez céntimos de euro menos sí dejan algo por cobrar.
    expect(settle(total, [eur(exact - 10)], [], table)).toMatchObject({ due: 12, settled: false });
  });

  it("un resto menor que medio céntimo se da por saldado", () => {
    // 38.995,19 Bs por algo de 38.995,20 Bs: falta un céntimo de bolívar, que no es nada en dólares.
    expect(settle(money(4500, "USD"), [ves(3899519)], [], table)).toMatchObject({ due: 0, changeDue: 0, settled: true });
    // Y al revés: 41 céntimos de bolívar de más no obligan a dar vuelto.
    expect(settle(money(4500, "USD"), [ves(3899561)], [], table)).toMatchObject({ due: 0, changeDue: 0, settled: true });
  });

  it("pagar de más genera vuelto, que se puede dar en otra moneda", () => {
    const over = settle(total, [usd(10000)], [], table);
    expect(over).toMatchObject({ due: 0, changeDue: 3500, settled: false });

    const inBolivars = amountIn(over.changeValue, "VES", table);
    expect(inBolivars).toBe(3032960);
    expect(settle(total, [usd(10000)], [ves(inBolivars)], table)).toMatchObject({ changeDue: 0, settled: true });
  });

  it("el vuelto se puede repartir entre monedas", () => {
    // 35 $ de vuelto: un billete de 20 $ y el resto en bolívares.
    const first = settle(total, [usd(10000)], [usd(2000)], table);
    expect(first).toMatchObject({ changeDue: 1500, settled: false });
    const rest = amountIn(first.changeValue, "VES", table);
    const done = settle(total, [usd(10000)], [usd(2000), ves(rest)], table);
    expect(done.change.map((c) => c.base)).toEqual([2000, 1500]);
    expect(done.settled).toBe(true);
  });

  it("dar más vuelto del que corresponde no cuadra", () => {
    expect(settle(total, [usd(7000)], [usd(600)], table)).toMatchObject({ changeDue: -100, settled: false });
  });

  it("no se puede dar vuelto si todavía falta por cobrar", () => {
    expect(settle(total, [usd(4000)], [usd(500)], table)).toMatchObject({ due: 2500, changeDue: -500, settled: false });
  });

  it("los pagos parciales suman siempre el total, sin céntimos perdidos por redondeo", () => {
    // Tres pagos de 18.775,47 Bs por algo de 65 $ (56.326,40 Bs): cada uno vale 21,6667 $.
    const result = settle(total, [ves(1877547), ves(1877547), ves(1877546)], [], table);
    expect(result.settled).toBe(true);
    expect(result.payments.map((p) => p.base)).toEqual([2167, 2166, 2167]);
    expect(result.payments.reduce((sum, p) => sum + p.base, 0)).toBe(6500);
  });

  it("una venta de total cero ya está saldada", () => {
    expect(settle(money(0, "USD"), [], [], table).settled).toBe(true);
  });

  it("conserva los datos propios de cada pago", () => {
    const result = settle(total, [{ ...usd(6500), methodId: "efectivo-usd" }], [], table);
    expect(result.payments[0]).toEqual({ currency: "USD", amount: 6500, methodId: "efectivo-usd", base: 6500 });
  });
});
