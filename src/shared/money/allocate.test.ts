import { describe, expect, it } from "vitest";
import { allocate, proportion } from "./allocate";

const sum = (parts: number[]) => parts.reduce((a, b) => a + b, 0);

describe("allocate", () => {
  it("reparte en proporción a los pesos", () => {
    expect(allocate(1000, [1, 1])).toEqual([500, 500]);
    expect(allocate(1000, [3, 1])).toEqual([750, 250]);
  });

  it("las partes suman siempre el total, aunque no divida exacto", () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocate(1, [1, 1, 1])).toEqual([1, 0, 0]);
    for (const total of [1, 7, 99, 1001, 123_457]) {
      const parts = allocate(total, [4500, 2000, 999, 1]);
      expect(sum(parts)).toBe(total);
    }
  });

  it("el céntimo suelto va a la parte con mayor resto", () => {
    // 10 entre pesos 1 y 2: 3,33 y 6,67 → el céntimo va al segundo.
    expect(allocate(10, [1, 2])).toEqual([3, 7]);
  });

  it("una parte sin peso no recibe nada", () => {
    expect(allocate(500, [0, 5, 0])).toEqual([0, 500, 0]);
  });

  it("reparte montos negativos con el mismo criterio", () => {
    expect(allocate(-100, [1, 1, 1])).toEqual([-34, -33, -33]);
  });

  it("sin pesos solo se puede repartir cero", () => {
    expect(allocate(0, [0, 0])).toEqual([0, 0]);
    expect(allocate(0, [])).toEqual([]);
    expect(() => allocate(5, [0, 0])).toThrow(RangeError);
  });

  it("rechaza pesos negativos o con decimales", () => {
    expect(() => allocate(10, [1, -1])).toThrow(RangeError);
    expect(() => allocate(10, [0.5, 1])).toThrow(RangeError);
  });

  it("no pierde precisión con montos grandes", () => {
    const parts = allocate(9_000_000_000_000, [3_333_333_333, 6_666_666_667]);
    expect(sum(parts)).toBe(9_000_000_000_000);
  });
});

describe("proportion", () => {
  it("calcula un porcentaje con un solo redondeo", () => {
    expect(proportion(6500, 10, 100)).toBe(650);
    expect(proportion(999, 15, 100)).toBe(150); // 149,85
    expect(proportion(5, 50, 100)).toBe(3); // 2,5 se aleja de cero
  });
});
