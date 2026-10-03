import type { CurrencyCode, Money } from "@shared/money";

export const CAJA = {
  methods: "caja:methods",
  setMethodActive: "caja:set-method-active",
  current: "caja:current",
  open: "caja:open",
  move: "caja:move",
  close: "caja:close",
  history: "caja:history",
  summary: "caja:summary",
} as const;

export const REASON_MAX = 80;
export const NOTE_MAX = 200;

/** El efectivo se cuenta en la gaveta; lo electrónico se comprueba contra el banco. */
export type MethodKind = "efectivo" | "electronico";

export interface PaymentMethod {
  id: string;
  name: string;
  currency: CurrencyCode;
  kind: MethodKind;
  active: boolean;
}

/** Lo que pasó con un medio de pago durante una caja. Montos en la moneda del medio. */
export interface MethodTotals {
  method: PaymentMethod;
  /** Fondo con el que se abrió. */
  opening: number;
  /** Entradas menos salidas registradas a mano. */
  moves: number;
  /** Cobrado en ventas. */
  sales: number;
  /** Vuelto entregado (negativo). */
  change: number;
  /** Lo que debería haber al cerrar. */
  expected: number;
  /** Lo que se contó al cerrar; null mientras la caja está abierta. */
  counted: number | null;
}

export interface SessionSummary {
  id: string;
  openedAt: string;
  /** null mientras está abierta. */
  closedAt: string | null;
  note: string;
  totals: MethodTotals[];
  salesCount: number;
  /** Total vendido, en la moneda de los precios. */
  salesTotals: Money[];
}

export interface SessionInfo {
  id: string;
  openedAt: string;
  closedAt: string | null;
  salesCount: number;
}

export interface OpenInput {
  /** Fondo inicial de cada medio en efectivo. */
  floats: Array<{ methodId: string; amount: number }>;
}

export interface MoveInput {
  methodId: string;
  kind: "entrada" | "salida";
  /** Siempre positivo; el tipo dice si entra o sale. */
  amount: number;
  reason: string;
}

export interface CloseInput {
  counts: Array<{ methodId: string; counted: number }>;
  note: string;
}
