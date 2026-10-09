import type { InvoiceMode, TaxRegime } from "@shared/settings";

export const FACTURACION = {
  status: "facturacion:status",
  saveLot: "facturacion:save-lot",
  ofSale: "facturacion:of-sale",
  issue: "facturacion:issue",
  record: "facturacion:record",
  void: "facturacion:void",
  voidSheet: "facturacion:void-sheet",
  list: "facturacion:list",
  exportBook: "facturacion:export-book",
} as const;

export const INVOICE_NUMBER_MAX = 30;
export const CONTROL_MAX = 30;
export const VOID_REASON_MAX = 120;
export const LOT_PRINTER_MAX = 80;
export const CONTROL_DIGITS = 8;
export const INVOICE_DIGITS = 8;
export const MAX_CONTROL = 99_999_999;

/** emitida: impresa por Ventamas en forma libre · externa: emitida por otro medio y anotada aquí. */
export type InvoiceKind = "emitida" | "externa";

export interface InvoiceCustomer {
  name: string;
  /** Cédula, RIF o pasaporte. */
  doc: string;
  address: string;
  phone: string;
}

/** Los datos de la tienda tal como salieron en la factura. */
export interface InvoiceIssuer {
  name: string;
  taxId: string;
  address: string;
  phone: string;
  regime: TaxRegime;
}

export interface Invoice {
  id: string;
  kind: InvoiceKind;
  saleId: string;
  /** "A-00000012", o el número que se anotó de una factura externa. */
  number: string;
  /** Número de control de la hoja; en una externa, el de control o el registro de la máquina fiscal. */
  control: string;
  customer: InvoiceCustomer;
  issuer: InvoiceIssuer;
  /** Día de emisión (AAAA-MM-DD). */
  issuedOn: string;
  createdAt: string;
  /** Si se anuló: por qué y cuándo. La venta sigue en pie; se puede volver a facturar. */
  voided: { reason: string; at: string } | null;
}

/** Un pedido de formas libres a la imprenta, con su rango de números de control. */
export interface ControlLot {
  id: string;
  /** Identificador que antecede al número: "00". */
  prefix: string;
  first: number;
  last: number;
  /** Nombre de la imprenta, para reconocer el lote. */
  printer: string;
  createdAt: string;
}

export interface LotInput {
  prefix: string;
  first: number;
  last: number;
  printer: string;
}

/** Lo que hace falta saber antes de emitir: qué número toca y qué falta por configurar. */
export interface InvoiceStatus {
  mode: InvoiceMode;
  /** El número que llevará la próxima factura. */
  nextNumber: string;
  lot: ControlLot | null;
  /** El número de control de la próxima hoja del lote; null si no hay lote o se agotó. */
  nextControl: string | null;
  /** Hojas del lote que quedan sin usar. */
  remaining: number;
  /** Lo que falta para poder emitir, en palabras. Vacío si todo está listo. */
  missing: string[];
}

export interface IssueInput {
  saleId: string;
  customer: InvoiceCustomer;
  /** El número de control de la hoja que está en la impresora. */
  control: string;
}

export interface RecordInput {
  saleId: string;
  number: string;
  control: string;
  /** Día de la factura (AAAA-MM-DD). */
  issuedOn: string;
}

/** Fila del auxiliar del libro de ventas. Montos en bolívares, a la tasa de la venta. */
export interface BookRow {
  invoiceId: string;
  saleId: string;
  kind: InvoiceKind;
  issuedOn: string;
  number: string;
  control: string;
  customerName: string;
  customerDoc: string;
  voided: boolean;
  /** Total de la venta, en céntimos de bolívar. Cero si está anulada. */
  total: number;
  /** Ventas exentas o sin desglose de impuesto. */
  exempt: number;
  /** Base e impuesto por cada tasa mayor que cero. */
  taxes: Array<{ rate: number; base: number; tax: number }>;
}

export interface Book {
  /** AAAA-MM */
  month: string;
  rows: BookRow[];
  /** Hojas anuladas en el mes sin llegar a ser factura. */
  voidedSheets: Array<{ control: string; reason: string; at: string }>;
  totals: { total: number; exempt: number; taxes: Array<{ rate: number; base: number; tax: number }> };
}

/** "00-00001234" */
export function formatControl(prefix: string, number: number): string {
  const digits = String(number).padStart(CONTROL_DIGITS, "0");
  return prefix ? `${prefix}-${digits}` : digits;
}

/** "A-00000012" */
export function formatInvoiceNumber(series: string, seq: number): string {
  const digits = String(seq).padStart(INVOICE_DIGITS, "0");
  return series ? `${series}-${digits}` : digits;
}

/** La fecha de una factura con sus ocho dígitos: 05/10/2026. */
export function formatInvoiceDate(day: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : day;
}
