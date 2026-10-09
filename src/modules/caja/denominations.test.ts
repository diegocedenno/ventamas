import { describe, expect, it } from "vitest";
import { BILLS, countTotal } from "./denominations";

describe("conteo por billetes", () => {
  it("suma cada billete por su cantidad, más lo suelto", () => {
    // 2 de 20, 1 de 10 y 3 de 1, más 0,75 en monedas: 53,75 $.
    expect(countTotal("USD", { 20: 2, 10: 1, 1: 3 }, 75)).toBe(5375);
    expect(countTotal("VES", { 500: 4, 100: 1 })).toBe(210_000);
    expect(countTotal("EUR", { 50: 1 })).toBe(5000);
  });

  it("una gaveta vacía da cero", () => {
    expect(countTotal("USD", {})).toBe(0);
  });

  it("no acepta cantidades negativas ni con decimales", () => {
    expect(countTotal("USD", { 20: -1 })).toBeNull();
    expect(countTotal("USD", { 20: 1.5 })).toBeNull();
    expect(countTotal("USD", {}, -5)).toBeNull();
  });

  it("los billetes de cada moneda van del mayor al menor, sin repetir", () => {
    for (const bills of Object.values(BILLS)) {
      expect([...bills].sort((a, b) => b - a)).toEqual(bills);
      expect(new Set(bills).size).toBe(bills.length);
    }
  });
});
