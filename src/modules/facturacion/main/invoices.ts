import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { convert, money } from "@shared/money";
import type { Settings } from "@shared/settings";
import { formatDoc } from "@shared/taxid";
import { asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import { localDay } from "../../../main/db/facts";
import { CUSTOMER_ADDRESS_MAX, CUSTOMER_DOC_MAX, CUSTOMER_NAME_MAX, CUSTOMER_PHONE_MAX } from "../../clientes/api";
import type { Sale } from "../../ventas/api";
import { getSale } from "../../ventas/main/sales";
import {
  CONTROL_DIGITS,
  CONTROL_MAX,
  formatControl,
  formatInvoiceNumber,
  INVOICE_NUMBER_MAX,
  LOT_PRINTER_MAX,
  MAX_CONTROL,
  VOID_REASON_MAX,
  type Book,
  type BookRow,
  type ControlLot,
  type Invoice,
  type InvoiceIssuer,
  type InvoiceKind,
  type InvoiceStatus,
} from "../api";

export type InvoiceSettings = Pick<
  Settings,
  | "invoice.mode"
  | "invoice.regime"
  | "invoice.series"
  | "invoice.start"
  | "store.name"
  | "store.legalName"
  | "store.taxId"
  | "store.address"
  | "store.phone"
  | "tax.enabled"
>;

interface InvoiceRow {
  id: string;
  kind: string;
  sale_id: string;
  number: string;
  control: string;
  customer_name: string;
  customer_doc: string;
  customer_address: string;
  customer_phone: string;
  issuer: string;
  issued_on: string;
  created_at: string;
  void_reason: string | null;
  void_at: string | null;
}

interface LotRow {
  id: string;
  prefix: string;
  first: number;
  last: number;
  printer: string;
  created_at: string;
}

const INVOICES = `
  SELECT i.id, i.kind, i.sale_id, i.number, i.control, i.customer_name, i.customer_doc, i.customer_address,
         i.customer_phone, i.issuer, i.issued_on, i.created_at, v.reason AS void_reason, v.created_at AS void_at
  FROM invoices i LEFT JOIN invoice_voids v ON v.invoice_id = i.id
`;

function parseIssuer(json: string): InvoiceIssuer {
  const empty: InvoiceIssuer = { name: "", taxId: "", address: "", phone: "", regime: "ordinario" };
  try {
    const raw = JSON.parse(json) as Partial<InvoiceIssuer>;
    return {
      name: typeof raw.name === "string" ? raw.name : "",
      taxId: typeof raw.taxId === "string" ? raw.taxId : "",
      address: typeof raw.address === "string" ? raw.address : "",
      phone: typeof raw.phone === "string" ? raw.phone : "",
      regime: raw.regime === "formal" ? "formal" : "ordinario",
    };
  } catch {
    return empty;
  }
}

const toInvoice = (row: InvoiceRow): Invoice => ({
  id: row.id,
  kind: row.kind as InvoiceKind,
  saleId: row.sale_id,
  number: row.number,
  control: row.control,
  customer: { name: row.customer_name, doc: row.customer_doc, address: row.customer_address, phone: row.customer_phone },
  issuer: parseIssuer(row.issuer),
  issuedOn: row.issued_on,
  createdAt: row.created_at,
  voided: row.void_reason !== null && row.void_at !== null ? { reason: row.void_reason, at: row.void_at } : null,
});

const toLot = (row: LotRow): ControlLot => ({
  id: row.id,
  prefix: row.prefix,
  first: row.first,
  last: row.last,
  printer: row.printer,
  createdAt: row.created_at,
});

const issuerOf = (settings: InvoiceSettings): InvoiceIssuer => ({
  name: settings["store.legalName"] || settings["store.name"],
  taxId: settings["store.taxId"],
  address: settings["store.address"],
  phone: settings["store.phone"],
  regime: settings["invoice.regime"],
});

/* ---------- formas libres y números de control ---------- */

/** El lote de formas libres en uso: el último que se registró. */
export function currentLot(db: Db): ControlLot | null {
  const row = db.prepare("SELECT id, prefix, first, last, printer, created_at FROM control_lots ORDER BY created_at DESC, rowid DESC LIMIT 1").get() as
    | LotRow
    | undefined;
  return row ? toLot(row) : null;
}

/** Los números de control ya gastados: en una factura o en una hoja anulada. */
function usedControls(db: Db): Set<string> {
  const rows = db
    .prepare("SELECT control FROM invoices WHERE kind = 'emitida' UNION SELECT control FROM voided_sheets")
    .all() as Array<{ control: string }>;
  return new Set(rows.map((row) => row.control));
}

/** La primera hoja del lote sin usar y cuántas quedan. */
function lotUsage(db: Db, lot: ControlLot): { next: string | null; remaining: number } {
  const used = usedControls(db);
  let next: string | null = null;
  let remaining = 0;
  for (let number = lot.first; number <= lot.last; number++) {
    const control = formatControl(lot.prefix, number);
    if (used.has(control)) continue;
    next ??= control;
    remaining++;
  }
  return { next, remaining };
}

/**
 * Lee un número de control escrito a mano ("1234", "00-00001234") y lo devuelve con el
 * formato del lote. Lanza UserError si no es de ese lote.
 */
function controlOf(text: string, lot: ControlLot): string {
  const digits = text.replace(/\D/g, "");
  if (digits === "") throw new UserError("Escribe el número de control de la hoja.");
  const prefix = lot.prefix.replace(/\D/g, "");
  // Con más cifras de las que lleva el número, las primeras son el identificador del lote.
  const own = digits.length > CONTROL_DIGITS ? digits.slice(-CONTROL_DIGITS) : digits;
  const lead = digits.length > CONTROL_DIGITS ? digits.slice(0, -CONTROL_DIGITS) : prefix;
  const number = Number(own);
  if (lead !== prefix || number < lot.first || number > lot.last) {
    throw new UserError(
      `El número de control ${text.trim()} no es del lote en uso (del ${formatControl(lot.prefix, lot.first)} al ${formatControl(lot.prefix, lot.last)}).`
    );
  }
  return formatControl(lot.prefix, number);
}

/** Registra un lote de formas libres recibido de la imprenta. Pasa a ser el lote en uso. */
export function saveLot(db: Db, value: unknown, now = new Date()): ControlLot {
  const input = asObject(value, "lote");
  const prefix = asText(input.prefix ?? "", "el identificador del lote", 4);
  const first = asInteger(input.first, "primer número de control");
  const last = asInteger(input.last, "último número de control");
  const printer = asText(input.printer ?? "", "el nombre de la imprenta", LOT_PRINTER_MAX);
  if (!/^\d{0,4}$/.test(prefix)) throw new UserError("El identificador del lote son las cifras que van antes del guion: por ejemplo, 00.");
  if (first < 1 || last > MAX_CONTROL) throw new UserError(`Los números de control van del 1 al ${MAX_CONTROL}.`);
  if (last < first) throw new UserError("El último número de control no puede ser menor que el primero.");

  return transaction(db, () => {
    const overlap = db
      .prepare("SELECT first, last FROM control_lots WHERE prefix = ? AND first <= ? AND last >= ? LIMIT 1")
      .get(prefix, last, first) as { first: number; last: number } | undefined;
    if (overlap) {
      throw new UserError(
        `Ese rango se cruza con un lote ya registrado (del ${formatControl(prefix, overlap.first)} al ${formatControl(prefix, overlap.last)}). Revisa los números de la caja de formas.`
      );
    }
    const id = randomUUID();
    db.prepare("INSERT INTO control_lots (id, prefix, first, last, printer, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(
      id,
      prefix,
      first,
      last,
      printer,
      now.toISOString()
    );
    return { id, prefix, first, last, printer, createdAt: now.toISOString() };
  });
}

/** Inutiliza una hoja del lote que se dañó o se imprimió mal sin llegar a ser factura. */
export function voidSheet(db: Db, controlValue: unknown, reasonValue: unknown, now = new Date()): InvoiceStatus["nextControl"] {
  const reason = asText(reasonValue ?? "", "el motivo", VOID_REASON_MAX, true);
  return transaction(db, () => {
    const lot = currentLot(db);
    if (!lot) throw new UserError("Registra primero el lote de formas libres.");
    const control = controlOf(asText(controlValue, "el número de control", CONTROL_MAX), lot);
    if (usedControls(db).has(control)) throw new UserError(`La hoja ${control} ya se usó o ya estaba anulada.`);
    db.prepare("INSERT INTO voided_sheets (control, reason, created_at) VALUES (?, ?, ?)").run(control, reason, now.toISOString());
    return lotUsage(db, lot).next;
  });
}

/* ---------- estado ---------- */

function nextSeq(db: Db, settings: InvoiceSettings): number {
  const row = db.prepare("SELECT COALESCE(MAX(seq), 0) AS seq FROM invoices WHERE series = ?").get(settings["invoice.series"]) as { seq: number };
  // La numeración sigue donde iba; "primera factura" solo adelanta el comienzo.
  return Math.max(row.seq + 1, settings["invoice.start"]);
}

/** Qué número toca y qué falta por configurar para poder emitir. */
export function invoiceStatus(db: Db, settings: InvoiceSettings): InvoiceStatus {
  const lot = currentLot(db);
  const usage = lot ? lotUsage(db, lot) : { next: null, remaining: 0 };
  const missing: string[] = [];
  if (settings["invoice.mode"] === "forma-libre") {
    if (!settings["store.legalName"] && !settings["store.name"]) missing.push("el nombre o la razón social de la tienda");
    if (!settings["store.taxId"]) missing.push("el RIF de la tienda");
    if (!settings["store.address"]) missing.push("la dirección de la tienda (su domicilio fiscal)");
    if (settings["invoice.regime"] === "ordinario" && !settings["tax.enabled"]) missing.push("activar el desglose de impuestos");
    if (!lot) missing.push("registrar el lote de formas libres");
    else if (usage.next === null) missing.push("registrar un lote nuevo: las formas del actual se agotaron");
  }
  return {
    mode: settings["invoice.mode"],
    nextNumber: formatInvoiceNumber(settings["invoice.series"], nextSeq(db, settings)),
    lot,
    nextControl: usage.next,
    remaining: usage.remaining,
    missing,
  };
}

/* ---------- facturas ---------- */

export function getInvoice(db: Db, idValue: unknown): Invoice {
  const row = db.prepare(`${INVOICES} WHERE i.id = ?`).get(asString(idValue, "factura")) as InvoiceRow | undefined;
  if (!row) throw new UserError("Esa factura no existe.");
  return toInvoice(row);
}

/** La factura vigente de una venta, o null si no tiene (o si la que tenía se anuló). */
export function invoiceOfSale(db: Db, saleValue: unknown): Invoice | null {
  const row = db
    .prepare(`${INVOICES} WHERE i.sale_id = ? AND v.invoice_id IS NULL ORDER BY i.created_at DESC LIMIT 1`)
    .get(asString(saleValue, "venta")) as InvoiceRow | undefined;
  return row ? toInvoice(row) : null;
}

function requireNoInvoice(db: Db, saleId: string): void {
  const existing = invoiceOfSale(db, saleId);
  if (existing) throw new UserError(`Esta venta ya tiene la factura ${existing.number}. Para emitir otra, primero anula esa.`);
}

function cleanCustomer(value: unknown): Invoice["customer"] {
  const raw = asObject(value, "cliente");
  const name = asText(raw.name ?? "", "el nombre del cliente", CUSTOMER_NAME_MAX);
  const doc = formatDoc(asText(raw.doc ?? "", "el documento del cliente", CUSTOMER_DOC_MAX));
  if (name === "") throw new UserError("La factura necesita el nombre o la razón social del cliente.");
  if (doc === "") throw new UserError("La factura necesita la cédula o el RIF del cliente.");
  return {
    name,
    doc,
    address: asText(raw.address ?? "", "la dirección del cliente", CUSTOMER_ADDRESS_MAX),
    phone: asText(raw.phone ?? "", "el teléfono del cliente", CUSTOMER_PHONE_MAX),
  };
}

const INSERT = `
  INSERT INTO invoices
    (id, kind, sale_id, series, seq, number, control, customer_name, customer_doc, customer_address, customer_phone, issuer, issued_on, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/**
 * Emite la factura de una venta para imprimirla en una forma libre. Toma el siguiente
 * número, sin saltos, y gasta el número de control de la hoja. No toca la venta.
 */
export function issueInvoice(db: Db, value: unknown, settings: InvoiceSettings, now = new Date()): Invoice {
  const input = asObject(value, "factura");
  const saleId = asString(input.saleId, "venta");
  const customer = cleanCustomer(input.customer);
  const controlText = asText(input.control ?? "", "el número de control", CONTROL_MAX);
  if (settings["invoice.mode"] !== "forma-libre") throw new UserError("La emisión de facturas en forma libre está apagada. Actívala en Ajustes.");

  return transaction(db, () => {
    const status = invoiceStatus(db, settings);
    if (status.missing.length > 0 || !status.lot) throw new UserError(`Antes de facturar falta ${status.missing.join("; ")}.`);
    const sale = getSale(db, saleId);
    requireNoInvoice(db, saleId);
    if (settings["invoice.regime"] === "ordinario" && sale.taxes.length === 0) {
      throw new UserError("Esta venta se cobró sin desglosar el impuesto, así que no se puede facturar. Las ventas nuevas ya lo llevan.");
    }
    const control = controlOf(controlText, status.lot);
    if (usedControls(db).has(control)) throw new UserError(`La hoja ${control} ya se usó. Revisa el número de control de la hoja que está en la impresora.`);

    const id = randomUUID();
    const seq = nextSeq(db, settings);
    db.prepare(INSERT).run(
      id,
      "emitida",
      saleId,
      settings["invoice.series"],
      seq,
      formatInvoiceNumber(settings["invoice.series"], seq),
      control,
      customer.name,
      customer.doc,
      customer.address,
      customer.phone,
      JSON.stringify(issuerOf(settings)),
      localDay(now),
      now.toISOString()
    );
    return getInvoice(db, id);
  });
}

/** Anota en una venta la factura que se emitió por otro medio: máquina fiscal, talonario o imprenta digital. */
export function recordExternal(db: Db, value: unknown, settings: InvoiceSettings, now = new Date()): Invoice {
  const input = asObject(value, "factura");
  const saleId = asString(input.saleId, "venta");
  const number = asText(input.number ?? "", "el número de la factura", INVOICE_NUMBER_MAX, true);
  const control = asText(input.control ?? "", "el número de control", CONTROL_MAX);
  const issuedOn = asString(input.issuedOn ?? localDay(now), "fecha");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issuedOn) || Number.isNaN(Date.parse(issuedOn))) throw new UserError("Esa fecha no es válida.");
  if (settings["invoice.mode"] === "off") throw new UserError("La facturación está apagada. Actívala en Ajustes.");

  return transaction(db, () => {
    const sale = getSale(db, saleId);
    requireNoInvoice(db, saleId);
    const id = randomUUID();
    db.prepare(INSERT).run(
      id,
      "externa",
      saleId,
      "",
      null,
      number,
      control,
      sale.customer?.name ?? "",
      sale.customer?.doc ?? "",
      "",
      "",
      JSON.stringify(issuerOf(settings)),
      issuedOn,
      now.toISOString()
    );
    return getInvoice(db, id);
  });
}

/** Anula una factura. La venta sigue en pie y se puede volver a facturar; la hoja y su número no se reutilizan. */
export function voidInvoice(db: Db, idValue: unknown, reasonValue: unknown, now = new Date()): Invoice {
  const reason = asText(reasonValue ?? "", "el motivo", VOID_REASON_MAX, true);
  return transaction(db, () => {
    const invoice = getInvoice(db, idValue);
    if (invoice.voided) throw new UserError("Esa factura ya estaba anulada.");
    db.prepare("INSERT INTO invoice_voids (invoice_id, reason, created_at) VALUES (?, ?, ?)").run(invoice.id, reason, now.toISOString());
    return getInvoice(db, invoice.id);
  });
}

/* ---------- auxiliar del libro de ventas ---------- */

/** Los montos de una venta en la moneda local, a la tasa con la que se cobró. La fila suma exacto. */
function localAmounts(sale: Sale): Pick<BookRow, "total" | "exempt" | "taxes"> {
  const local = sale.rates.pivot;
  const toLocal = (amount: number) => convert(money(amount, sale.currency), local, sale.rates).amount;
  const taxes = sale.taxes.filter((tax) => tax.rate > 0).map((tax) => ({ rate: tax.rate, base: toLocal(tax.base), tax: toLocal(tax.tax) }));
  // Sin desglose (contribuyente formal), toda la venta va como no gravada.
  const exempt = sale.taxes.length === 0 ? toLocal(sale.total) : sale.taxes.filter((tax) => tax.rate === 0).reduce((sum, tax) => sum + toLocal(tax.base), 0);
  return { taxes, exempt, total: exempt + taxes.reduce((sum, tax) => sum + tax.base + tax.tax, 0) };
}

/**
 * Las facturas de un mes con sus montos en moneda local: un auxiliar para que quien lleva
 * los libros arme el Libro de Ventas. No es el libro oficial.
 */
export function salesBook(db: Db, monthValue: unknown): Book {
  const month = asString(monthValue, "mes");
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new TypeError("Mes no válido.");
  const rows = db.prepare(`${INVOICES} WHERE i.issued_on LIKE ? ORDER BY i.issued_on, i.created_at`).all(`${month}-%`) as unknown as InvoiceRow[];

  const book: Book = { month, rows: [], voidedSheets: [], totals: { total: 0, exempt: 0, taxes: [] } };
  const totals = new Map<number, { rate: number; base: number; tax: number }>();
  for (const row of rows) {
    const invoice = toInvoice(row);
    const voided = invoice.voided !== null;
    // Una factura anulada se asienta con su número, sin montos.
    const amounts = voided ? { total: 0, exempt: 0, taxes: [] } : localAmounts(getSale(db, invoice.saleId));
    book.rows.push({
      invoiceId: invoice.id,
      saleId: invoice.saleId,
      kind: invoice.kind,
      issuedOn: invoice.issuedOn,
      number: invoice.number,
      control: invoice.control,
      customerName: invoice.customer.name,
      customerDoc: invoice.customer.doc,
      voided,
      ...amounts,
    });
    book.totals.total += amounts.total;
    book.totals.exempt += amounts.exempt;
    for (const tax of amounts.taxes) {
      const sum = totals.get(tax.rate) ?? { rate: tax.rate, base: 0, tax: 0 };
      sum.base += tax.base;
      sum.tax += tax.tax;
      totals.set(tax.rate, sum);
    }
  }
  book.totals.taxes = [...totals.values()].sort((a, b) => b.rate - a.rate);

  const sheets = db.prepare("SELECT control, reason, created_at FROM voided_sheets ORDER BY created_at").all() as Array<{
    control: string;
    reason: string;
    created_at: string;
  }>;
  book.voidedSheets = sheets
    .filter((sheet) => localDay(new Date(sheet.created_at)).startsWith(month))
    .map((sheet) => ({ control: sheet.control, reason: sheet.reason, at: sheet.created_at }));
  return book;
}

const csvCell = (value: string): string => (/[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value);
const csvAmount = (amount: number): string => (amount / 100).toFixed(2).replace(".", ",");
const csvRate = (rate: number): string => `${String(rate / 100).replace(".", ",")} %`;

/** El auxiliar del libro de ventas como hoja de cálculo (CSV con punto y coma, que es como lo abre Excel en español). */
export function bookCsv(book: Book): string {
  const rates = book.totals.taxes.map((tax) => tax.rate);
  const header = [
    "Fecha",
    "Factura",
    "Control",
    "Cliente",
    "RIF o cédula",
    "Total",
    "Exento o no gravado",
    ...rates.flatMap((rate) => [`Base ${csvRate(rate)}`, `Impuesto ${csvRate(rate)}`]),
    "Estado",
  ];
  const line = (cells: string[]) => cells.map(csvCell).join(";");
  const amountsOf = (taxes: BookRow["taxes"]) =>
    rates.flatMap((rate) => {
      const found = taxes.find((tax) => tax.rate === rate);
      return [csvAmount(found?.base ?? 0), csvAmount(found?.tax ?? 0)];
    });

  const lines = [
    line(header),
    ...book.rows.map((row) =>
      line([
        row.issuedOn.split("-").reverse().join("/"),
        row.number,
        row.control,
        row.customerName,
        row.customerDoc,
        csvAmount(row.total),
        csvAmount(row.exempt),
        ...amountsOf(row.taxes),
        row.voided ? "ANULADA" : row.kind === "externa" ? "Emitida por otro medio" : "Emitida",
      ])
    ),
    ...book.voidedSheets.map((sheet) =>
      line([
        localDay(new Date(sheet.at)).split("-").reverse().join("/"),
        "",
        sheet.control,
        sheet.reason,
        "",
        csvAmount(0),
        csvAmount(0),
        ...amountsOf([]),
        "HOJA ANULADA",
      ])
    ),
    line(["", "", "", "TOTALES", "", csvAmount(book.totals.total), csvAmount(book.totals.exempt), ...amountsOf(book.totals.taxes), ""]),
  ];
  // La marca inicial hace que Excel lea los acentos.
  return `﻿${lines.join("\r\n")}\r\n`;
}
