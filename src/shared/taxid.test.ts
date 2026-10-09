import { describe, expect, it } from "vitest";
import { digitsOf, formatDoc, hasValidCheck, parseTaxId, rifCheckDigit } from "./taxid";

describe("dígito verificador del RIF", () => {
  // RIF públicos de empresas conocidas: sirven para comprobar el cálculo contra la realidad.
  it("coincide con RIF reales", () => {
    expect(rifCheckDigit("J", "00124134")).toBe(5);
    expect(rifCheckDigit("J", "00095036")).toBe(9);
    expect(rifCheckDigit("G", "20009997")).toBe(6);
    expect(rifCheckDigit("V", "11470283")).toBe(4);
    expect(rifCheckDigit("J", "07013380")).toBe(5);
    expect(rifCheckDigit("J", "00153581")).toBe(0);
    expect(rifCheckDigit("G", "20000110")).toBe(0);
  });

  it("no comprueba las letras cuyo valor no se conoce", () => {
    expect(rifCheckDigit("C", "12345678")).toBeNull();
    expect(hasValidCheck(parseTaxId("C-12345678-9")!)).toBe(true);
  });

  it("cuando el cálculo da diez u once, el dígito es cero", () => {
    // V-00000002: 1×4 + 2×2 = 8 → 11 − 8 = 3.
    expect(rifCheckDigit("V", "00000002")).toBe(3);
    // J-00000005: 3×4 + 5×2 = 22 → resto 0 → 11 − 0 = 11 → 0.
    expect(rifCheckDigit("J", "00000005")).toBe(0);
  });

  it("completa con ceros un número corto", () => {
    expect(rifCheckDigit("J", "124134")).toBe(rifCheckDigit("J", "00124134"));
  });
});

describe("leer un documento", () => {
  it("reconoce una cédula escrita de cualquier manera", () => {
    for (const text of ["V-12345678", "v12345678", "V 12.345.678", "12345678", "12.345.678"]) {
      expect(parseTaxId(text)).toEqual({ kind: "V", number: "12345678", check: null, text: "V-12345678" });
    }
    expect(parseTaxId("E-81234567")?.text).toBe("E-81234567");
  });

  it("reconoce un RIF con su dígito verificador", () => {
    for (const text of ["J-00124134-5", "j001241345", "J 00124134 5"]) {
      expect(parseTaxId(text)).toEqual({ kind: "J", number: "00124134", check: "5", text: "J-00124134-5" });
    }
  });

  it("no reconoce lo que no es cédula ni RIF", () => {
    expect(parseTaxId("")).toBeNull();
    expect(parseTaxId("AB123456")).toBeNull();
    expect(parseTaxId("1234")).toBeNull();
    expect(parseTaxId("J-1234567890")).toBeNull();
  });

  it("comprueba el dígito verificador cuando lo hay", () => {
    expect(hasValidCheck(parseTaxId("J-00124134-5")!)).toBe(true);
    expect(hasValidCheck(parseTaxId("J-00124134-6")!)).toBe(false);
    // Una cédula no lleva dígito: no hay nada que comprobar.
    expect(hasValidCheck(parseTaxId("V-12345678")!)).toBe(true);
  });
});

describe("dar formato", () => {
  it("da formato a cédulas y RIF, y deja pasar lo demás en mayúsculas", () => {
    expect(formatDoc(" v12345678 ")).toBe("V-12345678");
    expect(formatDoc("g200099976")).toBe("G-20009997-6");
    expect(formatDoc("pasaporte  ab123")).toBe("PASAPORTE AB123");
    expect(formatDoc("")).toBe("");
  });

  it("saca solo las cifras", () => {
    expect(digitsOf("V-12.345.678")).toBe("12345678");
    expect(digitsOf("+58 (414) 555-12-34")).toBe("584145551234");
  });
});
