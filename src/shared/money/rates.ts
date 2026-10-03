// Tasas de cambio y conversión entre monedas.
//
// Una tasa dice cuántas unidades de la moneda pivote vale UNA unidad de otra moneda
// (p. ej. bolívares por dólar, como la publica el BCV). Se guarda como entero escalado
// para no perder precisión, y la conversión se hace con BigInt y un solo redondeo.

import { CURRENCIES, money, type CurrencyCode, type Money } from "./money";

/** Seis decimales de precisión: 866,56 Bs/USD se guarda como 866_560_000. */
export const RATE_SCALE = 1_000_000;
const RATE_DECIMALS = 6;

export interface RateTable {
  /** Moneda en la que se expresan las tasas (el bolívar en Venezuela). */
  readonly pivot: CurrencyCode;
  /** Unidades de pivote por una unidad de cada moneda, escaladas por RATE_SCALE. */
  readonly rates: Partial<Record<CurrencyCode, number>>;
}

/** Convierte "866.56" en su entero escalado. Solo acepta punto decimal y hasta seis decimales. */
export function rateFromDecimal(text: string): number {
  const match = /^(\d+)(?:\.(\d{1,6}))?$/.exec(text.trim());
  if (!match) throw new SyntaxError(`Tasa no válida: "${text}"`);
  const whole = match[1] as string;
  const fraction = (match[2] ?? "").padEnd(RATE_DECIMALS, "0");
  const scaled = Number(whole) * RATE_SCALE + Number(fraction);
  if (!Number.isSafeInteger(scaled) || scaled <= 0) {
    throw new RangeError(`Tasa fuera de rango: "${text}"`);
  }
  return scaled;
}

/** "866,56": sin ceros sobrantes, con al menos dos decimales. */
export function formatRate(scaled: number, locale = "es-VE"): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: RATE_DECIMALS,
  }).format(scaled / RATE_SCALE);
}

// División entera con redondeo al más cercano; los empates se alejan de cero.
function divRound(numerator: bigint, denominator: bigint): bigint {
  const negative = numerator < 0n !== denominator < 0n;
  const n = numerator < 0n ? -numerator : numerator;
  const d = denominator < 0n ? -denominator : denominator;
  const quotient = (n + d / 2n) / d;
  return negative ? -quotient : quotient;
}

function rateOf(code: CurrencyCode, table: RateTable): bigint {
  if (code === table.pivot) return BigInt(RATE_SCALE);
  const scaled = table.rates[code];
  if (scaled === undefined) throw new Error(`No hay tasa para ${code}`);
  if (!Number.isSafeInteger(scaled) || scaled <= 0) throw new RangeError(`Tasa no válida para ${code}`);
  return BigInt(scaled);
}

/**
 * Convierte un monto a otra moneda con las tasas dadas. Entre dos monedas que no son
 * el pivote (dólar ↔ euro) cruza por el pivote en una sola fracción, así que solo se
 * redondea una vez. El resultado se redondea a la unidad mínima de la moneda destino.
 */
export function convert(m: Money, to: CurrencyCode, table: RateTable): Money {
  if (m.currency === to) return m;
  const fromRate = rateOf(m.currency, table);
  const toRate = rateOf(to, table);
  const fromUnit = 10n ** BigInt(CURRENCIES[m.currency].decimals);
  const toUnit = 10n ** BigInt(CURRENCIES[to].decimals);
  const result = divRound(BigInt(m.amount) * fromRate * toUnit, toRate * fromUnit);
  return money(Number(result), to);
}
