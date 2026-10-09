// Cédula y RIF venezolanos: reconocerlos como los escribe una persona, darles su formato
// y comprobar el dígito verificador del RIF. Un documento que no encaje (un pasaporte, un
// registro de otro país) se deja pasar tal cual: aquí no se rechaza nada.

import { tidy } from "./text";

/** V: venezolano · E: extranjero · J: jurídico · G: gobierno · P: pasaporte · C: consejo comunal. */
export type TaxIdKind = "V" | "E" | "J" | "G" | "P" | "C";

export interface TaxId {
  kind: TaxIdKind;
  /** Las cifras, sin el dígito verificador. */
  number: string;
  /** Dígito verificador; null si es una cédula (no lo lleva). */
  check: string | null;
  /** "V-12345678" o "J-12345678-9". */
  text: string;
}

// La C existe, pero su valor en el cálculo no está confirmado: su dígito no se comprueba.
const KIND_VALUE: Partial<Record<TaxIdKind, number>> = { V: 1, E: 2, J: 3, P: 4, G: 5 };
const WEIGHTS = [3, 2, 7, 6, 5, 4, 3, 2];

/**
 * Dígito verificador de un RIF (módulo 11) a partir de su letra y sus ocho cifras. El
 * SENIAT no publica el algoritmo; este es el que usan las librerías conocidas y coincide
 * con los RIF reales de las pruebas. Devuelve null para las letras cuyo valor no se conoce.
 */
export function rifCheckDigit(kind: TaxIdKind, number: string): number | null {
  if (!/^\d{1,8}$/.test(number)) throw new RangeError("Un RIF lleva hasta ocho cifras antes del dígito verificador.");
  const value = KIND_VALUE[kind];
  if (value === undefined) return null;
  const digits = [...number.padStart(8, "0")].map(Number);
  const sum = value * 4 + digits.reduce((total, digit, index) => total + digit * (WEIGHTS[index] as number), 0);
  const rest = 11 - (sum % 11);
  return rest >= 10 ? 0 : rest;
}

/**
 * Lee una cédula o un RIF escritos de cualquier manera: "v12345678", "V-12.345.678",
 * "J-12345678-9", "j123456789". Sin letra se entiende que es una cédula venezolana.
 * Devuelve null si no tiene esa forma.
 */
export function parseTaxId(input: string): TaxId | null {
  const clean = input.replace(/[\s.\-_/]/g, "").toUpperCase();
  const match = /^([VEJGPC])?(\d{5,9})$/.exec(clean);
  if (!match) return null;
  const kind = (match[1] ?? "V") as TaxIdKind;
  const digits = match[2] as string;
  // Nueve cifras: las ocho del número y el dígito verificador.
  if (digits.length === 9) {
    const number = digits.slice(0, 8);
    const check = digits.slice(8);
    return { kind, number, check, text: `${kind}-${number}-${check}` };
  }
  return { kind, number: digits, check: null, text: `${kind}-${digits}` };
}

/** Falso solo si el documento trae un dígito verificador y no es el que le corresponde. */
export function hasValidCheck(id: TaxId): boolean {
  if (id.check === null) return true;
  const expected = rifCheckDigit(id.kind, id.number);
  return expected === null || Number(id.check) === expected;
}

/** El documento con su formato; si no es una cédula ni un RIF, el mismo texto en mayúsculas. */
export function formatDoc(input: string): string {
  return parseTaxId(input)?.text ?? tidy(input).toUpperCase();
}

/** Solo las cifras de un documento o de un teléfono, para buscar sin importar cómo se escribió. */
export function digitsOf(text: string): string {
  return text.replace(/\D/g, "");
}
