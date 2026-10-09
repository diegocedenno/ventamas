// Billetes de cada moneda, para contar el efectivo de la gaveta pieza por pieza en vez de
// sumarlo de cabeza. Es solo una ayuda para llegar al total: lo que se guarda es el total.

import { CURRENCIES, type CurrencyCode } from "@shared/money";

/** Billetes en circulación, en unidades de la moneda, del mayor al menor. */
export const BILLS: Record<CurrencyCode, readonly number[]> = {
  USD: [100, 50, 20, 10, 5, 2, 1],
  EUR: [200, 100, 50, 20, 10, 5],
  VES: [500, 200, 100, 50, 20, 10, 5],
};

/**
 * El total de un conteo por billetes, en unidad mínima: cuántos hay de cada billete, más
 * lo suelto (monedas y lo que no esté en la lista). Devuelve null si alguna cantidad no es
 * un entero mayor o igual que cero.
 */
export function countTotal(currency: CurrencyCode, quantities: Readonly<Record<number, number>>, loose = 0): number | null {
  const unit = 10 ** CURRENCIES[currency].decimals;
  let total = loose;
  if (!Number.isSafeInteger(loose) || loose < 0) return null;
  for (const bill of BILLS[currency]) {
    const quantity = quantities[bill] ?? 0;
    if (!Number.isSafeInteger(quantity) || quantity < 0) return null;
    total += quantity * bill * unit;
  }
  return Number.isSafeInteger(total) ? total : null;
}
