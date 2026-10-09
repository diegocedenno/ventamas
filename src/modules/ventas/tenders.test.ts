import { describe, expect, it } from "vitest";
import { suggestTenders } from "./tenders";

describe("montos sugeridos al cobrar en efectivo", () => {
  it("propone los billetes con los que se suele redondear un pago en dólares", () => {
    expect(suggestTenders(2500, "USD")).toEqual([3000, 4000, 5000]);
    expect(suggestTenders(6500, "USD")).toEqual([7000, 8000, 10000]);
    expect(suggestTenders(700, "USD")).toEqual([1000, 2000, 5000]);
    expect(suggestTenders(4999, "USD")).toEqual([5000, 6000, 10000]);
  });

  it("no repite lo que falta ni propone montos menores", () => {
    for (const due of [1, 99, 500, 2000, 10000, 123456]) {
      for (const amount of suggestTenders(due, "USD")) expect(amount).toBeGreaterThan(due);
    }
    expect(suggestTenders(2000, "USD")).toEqual([2500, 3000, 4000]);
  });

  it("en bolívares redondea a montos que se pagan de verdad, sin sugerencias casi iguales", () => {
    // Bs 21.664,00: a la decena siguiente, al medio millar y a los 22.500.
    expect(suggestTenders(2166400, "VES")).toEqual([2167000, 2200000, 2250000]);
    expect(suggestTenders(86656, "VES")).toEqual([87000, 90000, 100000]);
  });

  it("propone billetes de euro", () => {
    expect(suggestTenders(1780, "EUR")).toEqual([2000, 5000, 10000]);
  });

  it("sin nada que cobrar no propone nada", () => {
    expect(suggestTenders(0, "USD")).toEqual([]);
    expect(suggestTenders(-500, "USD")).toEqual([]);
  });
});
