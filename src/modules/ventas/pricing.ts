// La cuenta de una venta antes de cobrarla: precios, descuentos e impuestos. Es una
// función pura que usan la pantalla (para mostrar el total mientras se arma la venta) y
// el proceso principal (que la repite con los precios de la base de datos antes de
// registrar). Todo en enteros, y cada reparto suma exacto: ver
// docs/decisiones/0007-descuentos-e-impuestos.md.

import { allocate, proportion } from "@shared/money";

/** Porcentajes y tasas en centésimas de punto: 1600 = 16 %, 1250 = 12,5 %. */
export const PERCENT_SCALE = 10_000;

export type SaleDiscount =
  | { kind: "percent"; /** En centésimas de punto: 1000 = 10 %. */ value: number }
  | { kind: "amount"; /** En unidad mínima de la moneda de la venta. */ value: number };

export interface PricingLine {
  unitPrice: number;
  quantity: number;
  /** Descuento propio de la línea, como monto total (no por pieza). */
  discount: number;
  /** Impuesto que lleva; null si la tienda no cobra impuestos. */
  tax: { id: string; rate: number } | null;
}

export interface PricedLine {
  /** Precio por cantidad, sin descuentos. */
  gross: number;
  /** Descuento propio de la línea. */
  discount: number;
  /** Su parte del descuento general de la venta. */
  share: number;
  /** Lo que vale la línea después de los descuentos. */
  total: number;
  /** El impuesto de la línea: incluido en `total` o sumado aparte, según la tienda. */
  tax: number;
}

export interface PricedTax {
  id: string;
  rate: number;
  /** Monto sobre el que se calcula el impuesto. */
  base: number;
  tax: number;
}

export interface Pricing {
  lines: PricedLine[];
  /** Suma de precio por cantidad, sin descuentos. */
  subtotal: number;
  /** Suma de los descuentos propios de las líneas. */
  lineDiscounts: number;
  /** Descuento general de la venta, como monto. */
  discount: number;
  /** Suma de las líneas después de todos los descuentos. */
  net: number;
  taxes: PricedTax[];
  tax: number;
  /** Lo que paga el cliente. */
  total: number;
}

export class PricingError extends Error {}

/** El monto de un descuento general sobre `amount`. */
export function discountAmount(discount: SaleDiscount | null, amount: number): number {
  if (!discount) return 0;
  if (!Number.isSafeInteger(discount.value) || discount.value < 0) throw new PricingError("Descuento no válido.");
  if (discount.kind === "percent") {
    if (discount.value > PERCENT_SCALE) throw new PricingError("El descuento no puede pasar del 100 %.");
    return proportion(amount, discount.value, PERCENT_SCALE);
  }
  if (discount.value > amount) throw new PricingError("El descuento no puede ser mayor que la venta.");
  return discount.value;
}

/**
 * Calcula la venta. Si `taxIncluded`, los precios ya llevan el impuesto dentro y el total
 * es la suma de las líneas; si no, el impuesto se suma al final.
 *
 * El impuesto se calcula una sola vez por tasa, sobre el total de sus líneas, y después
 * se reparte entre ellas: así la suma de las líneas coincide con el total al céntimo.
 */
export function price(lines: readonly PricingLine[], discount: SaleDiscount | null, taxIncluded: boolean): Pricing {
  const afterOwn = lines.map((line) => {
    if (!Number.isSafeInteger(line.unitPrice) || line.unitPrice < 0) throw new PricingError("Precio no válido.");
    if (!Number.isSafeInteger(line.quantity) || line.quantity < 1) throw new PricingError("Cantidad no válida.");
    const gross = line.unitPrice * line.quantity;
    if (!Number.isSafeInteger(gross)) throw new PricingError("El monto de la línea es demasiado grande.");
    if (!Number.isSafeInteger(line.discount) || line.discount < 0 || line.discount > gross) {
      throw new PricingError("El descuento de una línea no puede ser mayor que su precio.");
    }
    return { gross, discount: line.discount, left: gross - line.discount };
  });

  const subtotal = afterOwn.reduce((sum, line) => sum + line.gross, 0);
  const lineDiscounts = afterOwn.reduce((sum, line) => sum + line.discount, 0);
  const beforeGeneral = subtotal - lineDiscounts;
  if (!Number.isSafeInteger(subtotal)) throw new PricingError("El total de la venta es demasiado grande.");

  const general = discountAmount(discount, beforeGeneral);
  const shares = general === 0 ? afterOwn.map(() => 0) : allocate(general, afterOwn.map((line) => line.left));
  const totals = afterOwn.map((line, index) => line.left - (shares[index] as number));
  const net = beforeGeneral - general;

  // Un impuesto por tasa, calculado sobre el total de sus líneas.
  const groups = new Map<string, { rate: number; indexes: number[] }>();
  lines.forEach((line, index) => {
    if (!line.tax) return;
    if (!Number.isSafeInteger(line.tax.rate) || line.tax.rate < 0 || line.tax.rate > PERCENT_SCALE) {
      throw new PricingError("Tasa de impuesto no válida.");
    }
    const group = groups.get(line.tax.id);
    if (group) group.indexes.push(index);
    else groups.set(line.tax.id, { rate: line.tax.rate, indexes: [index] });
  });

  const lineTax = lines.map(() => 0);
  const taxes: PricedTax[] = [];
  for (const [id, { rate, indexes }] of groups) {
    const amount = indexes.reduce((sum, index) => sum + (totals[index] as number), 0);
    const base = taxIncluded ? proportion(amount, PERCENT_SCALE, PERCENT_SCALE + rate) : amount;
    const tax = taxIncluded ? amount - base : proportion(amount, rate, PERCENT_SCALE);
    taxes.push({ id, rate, base, tax });
    if (tax === 0) continue;
    const parts = allocate(
      tax,
      indexes.map((index) => totals[index] as number)
    );
    indexes.forEach((index, at) => (lineTax[index] = parts[at] as number));
  }

  const tax = taxes.reduce((sum, entry) => sum + entry.tax, 0);
  return {
    lines: afterOwn.map((line, index) => ({
      gross: line.gross,
      discount: line.discount,
      share: shares[index] as number,
      total: totals[index] as number,
      tax: lineTax[index] as number,
    })),
    subtotal,
    lineDiscounts,
    discount: general,
    net,
    taxes,
    tax,
    total: taxIncluded ? net : net + tax,
  };
}
