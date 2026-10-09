import { describe, expect, it } from "vitest";
import type { Variant } from "../api";
import { buildPieces, fromVariants, marginOf, parseList, pieceKey, toggleInList, type PieceDraft } from "./variants";

const amount = (value: number) => (value / 100).toFixed(2).replace(".", ",");
const draft = (overrides: Partial<PieceDraft>): PieceDraft => ({ id: undefined, value1: "", value2: "", code: "", stock: "0", price: "", cost: "", ...overrides });

describe("parseList", () => {
  it("separa por comas y limpia espacios, vacíos y repetidos", () => {
    expect(parseList(" 36, 37 ,38,, 37 ")).toEqual(["36", "37", "38"]);
    expect(parseList("Negro; blanco\nNEGRO")).toEqual(["Negro", "blanco"]);
    expect(parseList("  ")).toEqual([]);
  });
});

describe("toggleInList", () => {
  it("añade un valor sugerido al final, o lo quita si ya estaba", () => {
    expect(toggleInList("", "M")).toBe("M");
    expect(toggleInList("S, M", "L")).toBe("S, M, L");
    expect(toggleInList("S, M, L", "m")).toBe("S, L");
    expect(toggleInList(" S ,, M ", "S")).toBe("M");
  });
});

describe("buildPieces", () => {
  const labels = (pieces: PieceDraft[]) => pieces.map((p) => `${p.value1}/${p.value2}`);

  it("sin variantes hay una sola pieza", () => {
    expect(buildPieces([], [], [], new Set())).toEqual([draft({})]);
  });

  it("cruza los dos ejes en orden", () => {
    expect(labels(buildPieces(["37", "38"], ["Negro", "Blanco"], [], new Set()))).toEqual(["37/Negro", "37/Blanco", "38/Negro", "38/Blanco"]);
    expect(labels(buildPieces(["S", "M"], [], [], new Set()))).toEqual(["S/", "M/"]);
    expect(labels(buildPieces([], ["Azul"], [], new Set()))).toEqual(["/Azul"]);
  });

  it("conserva lo ya escrito al añadir un valor", () => {
    const before = [draft({ id: "a", value1: "37", code: "X1", stock: "4", price: "48,00" })];
    expect(buildPieces(["37", "38"], [], before, new Set())).toEqual([
      draft({ id: "a", value1: "37", code: "X1", stock: "4", price: "48,00" }),
      draft({ value1: "38" }),
    ]);
  });

  it("no vuelve a generar las combinaciones quitadas", () => {
    const removed = new Set([pieceKey("38", "Blanco")]);
    expect(labels(buildPieces(["37", "38"], ["Negro", "Blanco"], [], removed))).toEqual(["37/Negro", "37/Blanco", "38/Negro"]);
  });
});

describe("fromVariants", () => {
  const variant = (id: string, value1: string, value2: string, stock = 0, price: number | null = null): Variant => ({
    id,
    value1,
    value2,
    code: "",
    stock,
    active: true,
    price,
    cost: null,
  });

  it("reconstruye las listas y detecta las combinaciones que no se venden", () => {
    const { values1, values2, pieces, removed } = fromVariants(
      [variant("a", "37", "Negro", 2), variant("b", "38", "Negro", 3), variant("c", "38", "Blanco", 1, 4800)],
      amount
    );
    expect(values1).toEqual(["37", "38"]);
    expect(values2).toEqual(["Negro", "Blanco"]);
    expect(pieces.map((p) => [p.stock, p.price])).toEqual([
      ["2", ""],
      ["3", ""],
      ["1", "48,00"],
    ]);
    expect([...removed]).toEqual([pieceKey("37", "Blanco")]);
    // Volver a generar con esas listas da exactamente las mismas piezas.
    expect(buildPieces(values1, values2, pieces, removed).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("un producto de pieza única no tiene listas", () => {
    expect(fromVariants([variant("a", "", "", 5)], amount)).toMatchObject({ values1: [], values2: [], removed: new Set() });
  });
});

describe("marginOf", () => {
  it("calcula ganancia, margen sobre el precio y recargo sobre el costo", () => {
    // Precio 45,00 y costo 28,00: se ganan 17,00; margen 37,8 % y recargo 60,7 %.
    expect(marginOf(4500, 2800)).toEqual({ profit: 1700, margin: 378, markup: 607 });
    // Un recargo del 50 % es un margen del 33,3 %.
    expect(marginOf(1500, 1000)).toEqual({ profit: 500, margin: 333, markup: 500 });
  });

  it("avisa cuando se vende por debajo del costo", () => {
    expect(marginOf(1000, 1200)).toMatchObject({ profit: -200, margin: -200 });
  });

  it("sin costo o sin precio no hay margen que mostrar", () => {
    expect(marginOf(4500, null)).toBeNull();
    expect(marginOf(0, 100)).toBeNull();
    expect(marginOf(100, 0)).toEqual({ profit: 100, margin: 1000, markup: null });
  });
});
