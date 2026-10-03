// La cuenta de un cobro en varias monedas: cuánto cubre cada pago, cuánto falta y cuánto
// vuelto corresponde. La usan la pantalla (para mostrarlo mientras se cobra) y el proceso
// principal (que la repite antes de registrar la venta): siempre dan lo mismo.
//
// Toda la cuenta se lleva en un "valor" exacto (enteros grandes, en moneda local), y solo
// se redondea al mostrar un monto en una moneda. Así, pagar 40.000 Bs por algo de
// 38.995,20 Bs deja un vuelto de 1.004,80 Bs exactos, sin pasar por céntimos de dólar.

import { CURRENCIES, RATE_SCALE, type CurrencyCode, type Money, type RateTable } from "@shared/money";

export interface MoneyEntry {
  currency: CurrencyCode;
  /** Positivo, en unidad mínima de su moneda. */
  amount: number;
}

export interface Settlement<P extends MoneyEntry, C extends MoneyEntry> {
  /** Cada pago con lo que cubre del total, en la moneda de la venta. Suman el total. */
  payments: Array<P & { base: number }>;
  change: Array<C & { base: number }>;
  /** Lo que falta por cobrar, en la moneda de la venta. Cero si ya está cubierto. */
  due: number;
  /** Vuelto que falta por entregar, en la moneda de la venta. Negativo si se está dando de más. */
  changeDue: number;
  /** Lo mismo, en valor exacto: para expresarlo en cualquier moneda con amountIn. */
  dueValue: bigint;
  changeValue: bigint;
  /** Cobrado y con el vuelto entregado: la venta se puede registrar. */
  settled: boolean;
}

// Decimales de holgura para que el valor sea entero con cualquier moneda.
const DECIMALS = 6n;

function unit(currency: CurrencyCode, table: RateTable): bigint {
  const rate = currency === table.pivot ? RATE_SCALE : table.rates[currency];
  if (rate === undefined) throw new Error(`No hay tasa para ${currency}`);
  return BigInt(rate) * 10n ** (DECIMALS - BigInt(CURRENCIES[currency].decimals));
}

/** El valor exacto de un monto. */
export function valueOf(amount: number, currency: CurrencyCode, table: RateTable): bigint {
  return BigInt(amount) * unit(currency, table);
}

/** Un valor expresado en una moneda, redondeado a su unidad mínima (los empates se alejan de cero). */
export function amountIn(value: bigint, currency: CurrencyCode, table: RateTable): number {
  const divisor = unit(currency, table);
  const magnitude = value < 0n ? -value : value;
  const rounded = Number((magnitude + divisor / 2n) / divisor);
  return value < 0n ? -rounded || 0 : rounded;
}

/**
 * Regla del monto exacto: si un pago es justo lo que falta expresado en su moneda, salda
 * lo que falta, sin que el redondeo deje un resto suelto. Lo mismo con el vuelto.
 * Un resto menor que medio céntimo de la moneda de la venta se da por saldado.
 */
export function settle<P extends MoneyEntry, C extends MoneyEntry>(
  total: Money,
  payments: readonly P[],
  change: readonly C[],
  table: RateTable
): Settlement<P, C> {
  const inSale = (value: bigint) => amountIn(value, total.currency, table);
  const worth = (entry: MoneyEntry, pending: bigint): bigint =>
    pending > 0n && entry.amount === amountIn(pending, entry.currency, table)
      ? pending
      : valueOf(entry.amount, entry.currency, table);

  const totalValue = valueOf(total.amount, total.currency, table);

  // Lo cobrado se acumula; lo que cubre cada pago es la diferencia entre acumulados ya
  // redondeados, así la suma de los pagos da siempre el total exacto.
  let collected = 0n;
  const paid = payments.map((payment) => {
    const before = inSale(collected);
    collected += worth(payment, totalValue - collected);
    return { ...payment, base: inSale(collected) - before };
  });

  const dueValue = totalValue > collected ? totalValue - collected : 0n;
  let changeValue = collected > totalValue ? collected - totalValue : 0n;
  let kept = collected;
  const given = change.map((entry) => {
    const before = inSale(kept);
    const value = worth(entry, changeValue);
    changeValue -= value;
    kept -= value;
    return { ...entry, base: before - inSale(kept) };
  });

  const due = inSale(dueValue);
  const changeDue = inSale(changeValue);
  return {
    payments: paid,
    change: given,
    due,
    changeDue,
    dueValue: due === 0 ? 0n : dueValue,
    changeValue,
    settled: due === 0 && changeDue === 0,
  };
}
