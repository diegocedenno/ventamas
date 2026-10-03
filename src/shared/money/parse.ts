// Lee números tal como los teclea una persona en el mostrador.
//
// Convención (español): la coma es el separador decimal y el punto el de miles, pero
// también se acepta el punto decimal del teclado numérico. Reglas, en orden:
//   · si hay coma y punto, el último que aparece es el decimal ("1.250,50", "1,250.50");
//   · una sola coma es decimal ("40,5"); varias comas son miles ("1,250,000");
//   · un solo punto seguido de exactamente tres cifras es de miles ("1.250" → 1250);
//   · cualquier otro punto único es decimal ("40.5"); varios puntos son miles.

import { CURRENCIES, money, type CurrencyCode, type Money } from "./money";
import { RATE_SCALE } from "./rates";

/** Devuelve el número escalado por 10^decimals, o null si el texto no es un número válido. */
export function parseDecimal(text: string, decimals: number): number | null {
  const clean = text.replace(/\s/g, "");
  if (!/^[\d.,]+$/.test(clean) || !/\d/.test(clean)) return null;

  const commas = clean.split(",").length - 1;
  const dots = clean.split(".").length - 1;
  let separator: "," | "." | null = null;

  if (commas > 0 && dots > 0) {
    separator = clean.lastIndexOf(",") > clean.lastIndexOf(".") ? "," : ".";
    // El separador decimal solo puede aparecer una vez.
    if ((separator === "," ? commas : dots) > 1) return null;
  } else if (commas === 1) {
    separator = ",";
  } else if (dots === 1) {
    const [whole = "", fraction = ""] = clean.split(".");
    separator = fraction.length === 3 && whole.length > 0 ? null : ".";
  }

  let whole = clean;
  let fraction = "";
  if (separator) {
    const at = clean.lastIndexOf(separator);
    whole = clean.slice(0, at);
    fraction = clean.slice(at + 1);
  }
  whole = whole.replace(/[.,]/g, "");
  if (fraction.length > decimals) return null;

  const scaled = Number(whole || "0") * 10 ** decimals + Number(fraction.padEnd(decimals, "0") || "0");
  return Number.isSafeInteger(scaled) ? scaled : null;
}

/** "40,5" en dólares → 40,50 $. Devuelve null si no se entiende o tiene más decimales que la moneda. */
export function parseAmount(text: string, currency: CurrencyCode): Money | null {
  const amount = parseDecimal(text, CURRENCIES[currency].decimals);
  return amount === null ? null : money(amount, currency);
}

/** "866,56" → tasa escalada. Devuelve null si no se entiende o es cero. */
export function parseRate(text: string): number | null {
  const scaled = parseDecimal(text, Math.log10(RATE_SCALE));
  return scaled === null || scaled <= 0 ? null : scaled;
}
