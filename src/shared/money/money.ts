// Dinero como enteros en la unidad mínima de cada moneda (céntimos, centavos).
// Nunca se usan decimales de punto flotante para montos: 0,1 + 0,2 no es 0,3.

export interface Currency {
  readonly code: string;
  readonly name: string;
  readonly symbol: string;
  /** Cantidad de decimales de la unidad mínima (2 → céntimos). */
  readonly decimals: number;
}

export const CURRENCIES = {
  VES: { code: "VES", name: "Bolívar", symbol: "Bs", decimals: 2 },
  USD: { code: "USD", name: "Dólar", symbol: "$", decimals: 2 },
  EUR: { code: "EUR", name: "Euro", symbol: "€", decimals: 2 },
} as const satisfies Record<string, Currency>;

export type CurrencyCode = keyof typeof CURRENCIES;

export interface Money {
  /** Monto en unidad mínima. Siempre un entero seguro. */
  readonly amount: number;
  readonly currency: CurrencyCode;
}

export function money(amount: number, currency: CurrencyCode): Money {
  if (!Number.isSafeInteger(amount)) {
    throw new RangeError(`El monto debe ser un entero en unidad mínima; llegó ${amount}`);
  }
  return { amount, currency };
}

export function zero(currency: CurrencyCode): Money {
  return money(0, currency);
}

function sameCurrency(a: Money, b: Money): void {
  if (a.currency !== b.currency) {
    throw new TypeError(`No se pueden operar ${a.currency} y ${b.currency} sin convertir`);
  }
}

export function add(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
}

export function subtract(a: Money, b: Money): Money {
  sameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
}

/** Precio por cantidad. La cantidad es un entero (piezas). */
export function times(m: Money, quantity: number): Money {
  if (!Number.isSafeInteger(quantity)) {
    throw new RangeError(`La cantidad debe ser un entero; llegó ${quantity}`);
  }
  return money(m.amount * quantity, m.currency);
}

export function negate(m: Money): Money {
  return money(m.amount === 0 ? 0 : -m.amount, m.currency);
}

export function compare(a: Money, b: Money): -1 | 0 | 1 {
  sameCurrency(a, b);
  return a.amount < b.amount ? -1 : a.amount > b.amount ? 1 : 0;
}

export function isZero(m: Money): boolean {
  return m.amount === 0;
}

/** "$ 65,00", "Bs 56.326,40", "−$ 5,00". El separador decimal sigue al idioma (coma en español). */
export function format(m: Money, locale = "es-VE"): string {
  const { symbol, decimals } = CURRENCIES[m.currency];
  const number = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Math.abs(m.amount) / 10 ** decimals);
  return `${m.amount < 0 ? "−" : ""}${symbol} ${number}`;
}
