import type { CurrencyCode, Money, RateTable } from "@shared/money";
import type { ProductKind } from "../inventario/api";
import type { SaleDiscount } from "./pricing";

export const VENTAS = {
  create: "ventas:create",
  get: "ventas:get",
  ofSession: "ventas:of-session",
  list: "ventas:list",
  park: "ventas:park",
  parked: "ventas:parked",
  takeParked: "ventas:take-parked",
  discardParked: "ventas:discard-parked",
} as const;

export const MAX_QUANTITY = 9999;
export const MAX_LINES = 200;
export const PAYMENT_NOTE_MAX = 40;
export const SALE_NOTE_MAX = 200;
export const PARK_LABEL_MAX = 40;
export const MAX_PARKED = 30;
/** El historial muestra como máximo esta cantidad de ventas; con más, hay que acotar las fechas. */
export const HISTORY_LIMIT = 300;

export interface SaleLineInput {
  variantId: string;
  quantity: number;
  /** Descuento propio de la línea, como monto total. */
  discount: number;
  /** Solo para productos de precio abierto: el precio que se escribió al vender. */
  price?: number;
}

export interface SaleInput {
  lines: SaleLineInput[];
  /** Descuento general de la venta. */
  discount: SaleDiscount | null;
  customerId: string | null;
  note: string;
  /** En el orden en que se recibieron. Montos positivos, en la moneda de cada medio. */
  payments: Array<{ methodId: string; amount: number; note: string }>;
  /** Vuelto entregado. Montos positivos, en la moneda de cada medio. */
  change: Array<{ methodId: string; amount: number }>;
  /** El total que vio quien cobra: si los precios cambiaron entretanto, la venta no se registra. */
  expectedTotal: number;
}

export interface SaleLine {
  description: string;
  kind: ProductKind;
  quantity: number;
  unitPrice: number;
  /** Descuento propio de la línea. */
  discount: number;
  /** Su parte del descuento general. */
  share: number;
  /** Lo que vale la línea después de los descuentos. */
  total: number;
  /** Letra de su impuesto (G, R, E); vacío si la venta no desglosa impuestos. */
  taxCode: string;
  /** En centésimas de punto; null si la venta no desglosa impuestos. */
  taxRate: number | null;
  /** Impuesto de la línea: dentro de `total` o aparte, según la venta. */
  tax: number;
}

export interface SaleTax {
  id: string;
  name: string;
  code: string;
  rate: number;
  base: number;
  tax: number;
}

export interface SaleMoneyLine {
  methodName: string;
  currency: CurrencyCode;
  /** Siempre positivo. */
  amount: number;
  /** Referencia del pago (los últimos dígitos del pago móvil, por ejemplo). */
  note: string;
}

/** El cliente tal como se llamaba al hacer la venta. */
export interface SaleCustomer {
  id: string;
  name: string;
  doc: string;
}

export interface Sale {
  id: string;
  /** C01-000012 */
  number: string;
  createdAt: string;
  currency: CurrencyCode;
  /** Suma de precio por cantidad, sin descuentos. */
  subtotal: number;
  /** Suma de los descuentos propios de las líneas. */
  lineDiscounts: number;
  /** Descuento general, como monto. */
  discount: number;
  /** Si el descuento general se dio como porcentaje, cuál fue (en centésimas de punto). */
  discountPercent: number | null;
  /** Impuesto total: dentro del total o sumado, según `taxIncluded`. */
  tax: number;
  taxIncluded: boolean;
  /** Desglose por tasa; vacío si la venta no desglosa impuestos. */
  taxes: SaleTax[];
  total: number;
  /** Las tasas con las que se cobró. No cambian aunque la tasa del día cambie después. */
  rates: RateTable;
  lines: SaleLine[];
  customer: SaleCustomer | null;
  note: string;
  payments: SaleMoneyLine[];
  change: SaleMoneyLine[];
}

export interface SaleInfo {
  id: string;
  number: string;
  createdAt: string;
  currency: CurrencyCode;
  total: number;
  pieces: number;
  /** Vacío si la venta no tiene cliente. */
  customerName: string;
}

export interface SaleFilter {
  /** Día de la tienda (AAAA-MM-DD) desde el que buscar, incluido. */
  from?: string | null;
  /** Día hasta el que buscar, incluido. */
  to?: string | null;
  /** Número de venta o nombre del cliente. */
  query?: string;
  customerId?: string | null;
}

export interface SalesPage {
  sales: SaleInfo[];
  /** Ventas que cumplen el filtro, aunque no todas quepan en la lista. */
  count: number;
  /** Total vendido con ese filtro, por moneda. */
  totals: Money[];
}

/** Una venta que se dejó en espera para atender a otro cliente. */
export interface ParkInput {
  label: string;
  lines: SaleLineInput[];
  discount: SaleDiscount | null;
  customerId: string | null;
  note: string;
}

export interface ParkedInfo {
  id: string;
  label: string;
  createdAt: string;
  pieces: number;
}

/** Una línea de una venta en espera, con el precio y las existencias de ahora. */
export interface ResumedLine {
  variantId: string;
  description: string;
  kind: ProductKind;
  unitPrice: number;
  openPrice: boolean;
  taxClass: string;
  stock: number;
  quantity: number;
  discount: number;
}

export interface ResumedSale {
  label: string;
  lines: ResumedLine[];
  /** Productos que estaban en la venta y ya no se venden. */
  dropped: number;
  discount: SaleDiscount | null;
  customerId: string | null;
  note: string;
}
