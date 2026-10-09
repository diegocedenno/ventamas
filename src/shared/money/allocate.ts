// Reparto exacto: dividir un monto entre varias partes sin que se pierda ni sobre un
// céntimo. Lo usan el descuento general de una venta (se reparte entre sus líneas) y el
// impuesto de cada línea (se reparte desde el total de su tasa).

/**
 * Reparte `total` en partes proporcionales a `weights`. Las partes son enteros y suman
 * exactamente `total`: lo que el redondeo deja suelto va a las partes con mayor resto.
 * Los pesos no pueden ser negativos; si todos son cero, `total` también debe serlo.
 */
export function allocate(total: number, weights: readonly number[]): number[] {
  if (!Number.isSafeInteger(total)) throw new RangeError(`El monto a repartir debe ser un entero; llegó ${total}`);
  for (const weight of weights) {
    if (!Number.isSafeInteger(weight) || weight < 0) throw new RangeError(`Peso no válido: ${weight}`);
  }
  const sum = weights.reduce((a, b) => a + BigInt(b), 0n);
  if (sum === 0n) {
    if (total !== 0) throw new RangeError("No hay entre qué repartir el monto.");
    return weights.map(() => 0);
  }

  const negative = total < 0;
  const amount = BigInt(Math.abs(total));
  const parts = weights.map((weight) => (amount * BigInt(weight)) / sum);
  const remainders = weights.map((weight, index) => ({ index, rest: (amount * BigInt(weight)) % sum }));
  let left = amount - parts.reduce((a, b) => a + b, 0n);

  // Los céntimos sueltos van a quien más cerca quedó de ganarse uno; a igual resto, al primero.
  remainders.sort((a, b) => (a.rest === b.rest ? a.index - b.index : a.rest > b.rest ? -1 : 1));
  for (const { index } of remainders) {
    if (left === 0n) break;
    parts[index] = (parts[index] as bigint) + 1n;
    left -= 1n;
  }
  return parts.map((part) => (negative && part !== 0n ? -Number(part) : Number(part)));
}

/** `amount` por `numerator` entre `denominator`, redondeado al más cercano (los empates se alejan de cero). */
export function proportion(amount: number, numerator: number, denominator: number): number {
  if (denominator <= 0) throw new RangeError("El divisor debe ser mayor que cero.");
  const product = BigInt(amount) * BigInt(numerator);
  const d = BigInt(denominator);
  const negative = product < 0n;
  const n = negative ? -product : product;
  const quotient = (n + d / 2n) / d;
  return Number(negative ? -quotient : quotient);
}
