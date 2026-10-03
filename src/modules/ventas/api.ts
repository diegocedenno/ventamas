import type { CurrencyCode, RateTable } from "@shared/money";

export const VENTAS = {
  create: "ventas:create",
  get: "ventas:get",
  ofSession: "ventas:of-session",
} as const;

export const MAX_QUANTITY = 9999;
export const MAX_LINES = 200;
export const PAYMENT_NOTE_MAX = 40;

export interface SaleInput {
  lines: Array<{ variantId: string; quantity: number }>;
  /** En el orden en que se recibieron. Montos positivos, en la moneda de cada medio. */
  payments: Array<{ methodId: string; amount: number; note: string }>;
  /** Vuelto entregado. Montos positivos, en la moneda de cada medio. */
  change: Array<{ methodId: string; amount: number }>;
  /** El total que vio quien cobra: si los precios cambiaron entretanto, la venta no se registra. */
  expectedTotal: number;
}

export interface SaleLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface SaleMoneyLine {
  methodName: string;
  currency: CurrencyCode;
  /** Siempre positivo. */
  amount: number;
  /** Referencia del pago (los últimos dígitos del pago móvil, por ejemplo). */
  note: string;
}

export interface Sale {
  id: string;
  /** C01-000012 */
  number: string;
  createdAt: string;
  currency: CurrencyCode;
  total: number;
  /** Las tasas con las que se cobró. No cambian aunque la tasa del día cambie después. */
  rates: RateTable;
  lines: SaleLine[];
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
}
