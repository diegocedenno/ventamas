import { describe, expect, it } from "vitest";
import { money } from "./money";
import { parseAmount, parseDecimal, parseRate } from "./parse";

describe("parseDecimal", () => {
  it.each([
    ["40", 4000],
    ["40,5", 4050],
    ["40,50", 4050],
    ["40.5", 4050],
    ["40.50", 4050],
    ["0,05", 5],
    [",5", 50],
    ["1.250", 125000],
    ["1.250,5", 125050],
    ["1,250.50", 125050],
    ["1.250.000", 125000000],
    ["1,250,000", 125000000],
    [" 1 250,00 ", 125000],
    ["007", 700],
  ])("lee %j con dos decimales como %i", (text, expected) => {
    expect(parseDecimal(text, 2)).toBe(expected);
  });

  it.each(["", " ", "abc", "-5", "1,2,3.4,5", "12,345", "0,001", "1.2.3,4,5", ".", ",", "1e3", "$40"])(
    "rechaza %j",
    (text) => {
      expect(parseDecimal(text, 2)).toBeNull();
    }
  );

  it("rechaza números demasiado grandes", () => {
    expect(parseDecimal("99999999999999999", 2)).toBeNull();
  });
});

describe("parseAmount", () => {
  it("devuelve el monto en la moneda pedida", () => {
    expect(parseAmount("40", "USD")).toEqual(money(4000, "USD"));
    expect(parseAmount("21.664,00", "VES")).toEqual(money(2166400, "VES"));
    expect(parseAmount("nada", "USD")).toBeNull();
  });
});

describe("parseRate", () => {
  it("lee tasas con coma o con punto, hasta seis decimales", () => {
    expect(parseRate("866,56")).toBe(866_560_000);
    expect(parseRate("866.5612")).toBe(866_561_200);
    expect(parseRate("1.012,30")).toBe(1_012_300_000);
    expect(parseRate("973,928133")).toBe(973_928_133);
  });

  it("rechaza cero, texto y más de seis decimales", () => {
    expect(parseRate("0")).toBeNull();
    expect(parseRate("tasa")).toBeNull();
    expect(parseRate("973,92813268")).toBeNull();
  });
});
