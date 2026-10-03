import { describe, expect, it } from "vitest";
import { buildPieces, fromVariants, parseList, pieceKey } from "./variants";

describe("parseList", () => {
  it("separa por comas y limpia espacios, vacíos y repetidos", () => {
    expect(parseList(" 36, 37 ,38,, 37 ")).toEqual(["36", "37", "38"]);
    expect(parseList("Negro; blanco\nNEGRO")).toEqual(["Negro", "blanco"]);
    expect(parseList("  ")).toEqual([]);
  });
});

describe("buildPieces", () => {
  const labels = (pieces: Array<{ size: string; color: string }>) => pieces.map((p) => `${p.size}/${p.color}`);

  it("sin tallas ni colores hay una sola pieza", () => {
    expect(buildPieces([], [], [], new Set())).toEqual([{ id: undefined, size: "", color: "", code: "", stock: "0" }]);
  });

  it("cruza tallas y colores en orden", () => {
    expect(labels(buildPieces(["37", "38"], ["Negro", "Blanco"], [], new Set()))).toEqual([
      "37/Negro",
      "37/Blanco",
      "38/Negro",
      "38/Blanco",
    ]);
    expect(labels(buildPieces(["S", "M"], [], [], new Set()))).toEqual(["S/", "M/"]);
    expect(labels(buildPieces([], ["Azul"], [], new Set()))).toEqual(["/Azul"]);
  });

  it("conserva lo ya escrito al añadir una talla", () => {
    const before = [{ id: "a", size: "37", color: "", code: "X1", stock: "4" }];
    expect(buildPieces(["37", "38"], [], before, new Set())).toEqual([
      { id: "a", size: "37", color: "", code: "X1", stock: "4" },
      { id: undefined, size: "38", color: "", code: "", stock: "0" },
    ]);
  });

  it("no vuelve a generar las combinaciones quitadas", () => {
    const removed = new Set([pieceKey("38", "Blanco")]);
    expect(labels(buildPieces(["37", "38"], ["Negro", "Blanco"], [], removed))).toEqual(["37/Negro", "37/Blanco", "38/Negro"]);
  });
});

describe("fromVariants", () => {
  const variant = (id: string, size: string, color: string, stock = 0) => ({ id, size, color, code: "", stock, active: true });

  it("reconstruye las listas y detecta las combinaciones que no se venden", () => {
    const { sizes, colors, pieces, removed } = fromVariants([
      variant("a", "37", "Negro", 2),
      variant("b", "38", "Negro", 3),
      variant("c", "38", "Blanco", 1),
    ]);
    expect(sizes).toEqual(["37", "38"]);
    expect(colors).toEqual(["Negro", "Blanco"]);
    expect(pieces.map((p) => p.stock)).toEqual(["2", "3", "1"]);
    expect([...removed]).toEqual([pieceKey("37", "Blanco")]);
    // Volver a generar con esas listas da exactamente las mismas piezas.
    expect(buildPieces(sizes, colors, pieces, removed).map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("un producto de pieza única no tiene listas", () => {
    expect(fromVariants([variant("a", "", "", 5)])).toMatchObject({ sizes: [], colors: [], removed: new Set() });
  });
});
