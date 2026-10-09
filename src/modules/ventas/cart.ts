// La venta mientras se arma en pantalla: sus líneas, sus descuentos y el vuelto que se
// propone. Funciones puras, sin nada de interfaz, para poder probarlas.

import { CURRENCIES, proportion, type CurrencyCode, type RateTable } from "@shared/money";
import type { PaymentMethod } from "../caja/api";
import type { ProductKind } from "../inventario/api";
import type { SaleLineInput } from "./api";
import { PERCENT_SCALE, price, type Pricing, type SaleDiscount } from "./pricing";
import { amountIn, valueOf } from "./settlement";

export interface CartLine {
  /** Identifica la línea en pantalla. */
  key: number;
  variantId: string;
  description: string;
  kind: ProductKind;
  unitPrice: number;
  /** El precio se escribió al añadirla: cada vez es una línea aparte. */
  openPrice: boolean;
  taxClass: string;
  quantity: number;
  /** Existencias de la pieza cuando se añadió. */
  stock: number;
  /** Descuento propio: un porcentaje de la línea o un monto sobre toda ella. */
  discount: SaleDiscount | null;
}

/** El descuento propio de una línea, como monto. Nunca pasa de lo que vale la línea. */
export function lineDiscount(line: Pick<CartLine, "unitPrice" | "quantity" | "discount">): number {
  const gross = line.unitPrice * line.quantity;
  if (!line.discount) return 0;
  if (line.discount.kind === "percent") return proportion(gross, Math.min(line.discount.value, PERCENT_SCALE), PERCENT_SCALE);
  return Math.min(line.discount.value, gross);
}

/** El descuento general tal como se puede aplicar: un monto nunca pasa de lo que queda por cobrar. */
export function usableDiscount(lines: readonly CartLine[], discount: SaleDiscount | null): SaleDiscount | null {
  if (!discount || discount.value <= 0) return null;
  if (discount.kind === "percent") return { kind: "percent", value: Math.min(discount.value, PERCENT_SCALE) };
  const left = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity - lineDiscount(line), 0);
  const value = Math.min(discount.value, left);
  return value > 0 ? { kind: "amount", value } : null;
}

/** La cuenta de la venta en pantalla. `taxOf` da la tasa de un producto, o null si la tienda no cobra impuestos. */
export function priceCart(
  lines: readonly CartLine[],
  discount: SaleDiscount | null,
  taxOf: (taxClass: string) => { id: string; rate: number } | null,
  taxIncluded: boolean
): Pricing {
  return price(
    lines.map((line) => ({ unitPrice: line.unitPrice, quantity: line.quantity, discount: lineDiscount(line), tax: taxOf(line.taxClass) })),
    usableDiscount(lines, discount),
    taxIncluded
  );
}

/** Las líneas tal como se mandan a registrar. */
export function toSaleLines(lines: readonly CartLine[]): SaleLineInput[] {
  return lines.map((line) => ({
    variantId: line.variantId,
    quantity: line.quantity,
    discount: lineDiscount(line),
    price: line.openPrice ? line.unitPrice : undefined,
  }));
}

export interface ChangePart {
  method: PaymentMethod;
  amount: number;
}

/**
 * El vuelto que se propone: en el mismo efectivo con que se pagó de más o, si no, en el de
 * la moneda de los precios. En una divisa no circulan monedas, así que solo se proponen
 * unidades enteras y la fracción se da en efectivo de la moneda local. Quien cobra puede
 * cambiarlo a mano.
 */
export function proposeChange(
  value: bigint,
  paidWith: PaymentMethod | undefined,
  methods: readonly PaymentMethod[],
  currency: CurrencyCode,
  table: RateTable
): ChangePart[] {
  if (value <= 0n) return [];
  const cash = methods.filter((method) => method.kind === "efectivo");
  const method = (paidWith?.kind === "efectivo" ? paidWith : undefined) ?? cash.find((m) => m.currency === currency) ?? cash[0];
  if (!method) return [];

  const amount = amountIn(value, method.currency, table);
  const local = cash.find((m) => m.currency === table.pivot);
  if (method.currency !== table.pivot && local) {
    const unit = 10 ** CURRENCIES[method.currency].decimals;
    const whole = Math.floor(amount / unit) * unit;
    if (whole !== amount) {
      const rest = amountIn(value - valueOf(whole, method.currency, table), local.currency, table);
      if (rest > 0) return whole > 0 ? [{ method, amount: whole }, { method: local, amount: rest }] : [{ method: local, amount: rest }];
    }
  }
  return amount > 0 ? [{ method, amount }] : [];
}
