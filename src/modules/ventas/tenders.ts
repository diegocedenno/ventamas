// Montos que conviene ofrecer con un toque al cobrar en efectivo: el billete o la suma de
// billetes con que el cliente suele pagar. Son solo atajos: siempre se puede escribir otro.

import { CURRENCIES, type CurrencyCode } from "@shared/money";

/** Billetes con los que se suele pagar, en unidades de la moneda. */
const BILLS: Record<CurrencyCode, readonly number[]> = {
  USD: [5, 10, 20, 50, 100],
  EUR: [5, 10, 20, 50, 100, 200],
  VES: [10, 20, 50, 100, 200, 500],
};

const MAX_SUGGESTIONS = 3;
/** Dos sugerencias casi iguales no ayudan: cada una supera a la anterior al menos en esto. */
const MIN_STEP = 1.015;

/**
 * Hasta tres montos mayores que `due` (lo que falta, en unidad mínima) a los que el
 * cliente podría redondear su pago: 25 $ → 30, 40 y 50. Además de los billetes se prueban
 * los redondeos a 1, 2 y 5 seguidos de ceros, que es como se paga con montos grandes.
 */
export function suggestTenders(due: number, currency: CurrencyCode): number[] {
  if (!Number.isSafeInteger(due) || due <= 0) return [];
  const unit = 10 ** CURRENCIES[currency].decimals;
  const steps = new Set<number>(BILLS[currency]);
  const largest = Math.max(...BILLS[currency]);
  for (let power = largest * 2; power <= (due / unit) * 10; power *= 10) {
    steps.add(power);
    steps.add(power * 2.5);
    steps.add(power * 5);
  }

  const candidates = [...steps]
    // El siguiente múltiplo por encima de lo que falta: para 20 $, el billete de 50 y no el de 20.
    .map((step) => (Math.floor(due / (step * unit)) + 1) * step * unit)
    .filter((amount) => Number.isSafeInteger(amount))
    .sort((a, b) => a - b);

  const suggestions: number[] = [];
  for (const amount of candidates) {
    const last = suggestions.at(-1);
    if (last !== undefined && amount < last * MIN_STEP) continue;
    suggestions.push(amount);
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}
