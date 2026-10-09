import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { money, type CurrencyCode, type Money, type RateTable } from "@shared/money";
import type { Settings } from "@shared/settings";
import { normalize } from "@shared/text";
import { asArray, asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import { getMethod, recordSaleMoney, requireOpenSession, type SaleMoney } from "../../caja/main/cash";
import { findCustomer } from "../../clientes/main/customers";
import { DEFAULT_TAX_CLASS, type TaxClass } from "../../impuestos/api";
import { findTaxClass } from "../../impuestos/main/taxes";
import type { ProductKind } from "../../inventario/api";
import { getSaleItem, recordSaleStock } from "../../inventario/main/products";
import { getRatesState, rateTable } from "../../monedas/main/rates";
import {
  HISTORY_LIMIT,
  MAX_LINES,
  MAX_QUANTITY,
  PAYMENT_NOTE_MAX,
  SALE_NOTE_MAX,
  type Sale,
  type SaleInfo,
  type SaleLineInput,
  type SaleMoneyLine,
  type SalesPage,
} from "../api";
import { price, PricingError, type SaleDiscount } from "../pricing";
import { settle } from "../settlement";

export const saleNumber = (prefix: string, seq: number): string => `${prefix}-${String(seq).padStart(6, "0")}`;

export type SaleSettings = Pick<Settings, "store.currency" | "device.prefix" | "tax.enabled" | "tax.included">;

interface SaleRow {
  id: string;
  prefix: string;
  seq: number;
  currency: string;
  total: number;
  rates: string;
  created_at: string;
  customer_id: string | null;
  customer_name: string;
  customer_doc: string;
  discount: number;
  discount_percent: number | null;
  tax: number;
  tax_included: number;
  note: string;
}

function activeMethod(db: Db, id: string) {
  const method = getMethod(db, id);
  if (!method.active) throw new UserError(`«${method.name}» está desactivado. Quítalo de la venta y usa otro medio de pago.`);
  return method;
}

/** Las líneas de una venta tal como llegan de la pantalla, ya comprobadas. */
export function parseLines(value: unknown): SaleLineInput[] {
  const raw = asArray(value, "líneas");
  if (raw.length > MAX_LINES) throw new UserError(`Una venta no puede tener más de ${MAX_LINES} líneas.`);
  return raw.map((item) => {
    const line = asObject(item, "línea");
    const quantity = asInteger(line.quantity, "cantidad");
    if (quantity < 1 || quantity > MAX_QUANTITY) throw new UserError(`La cantidad va de 1 a ${MAX_QUANTITY}.`);
    const discount = line.discount === undefined ? 0 : asInteger(line.discount, "descuento");
    if (discount < 0) throw new UserError("El descuento no puede ser negativo.");
    const price = line.price === undefined || line.price === null ? undefined : asInteger(line.price, "precio");
    if (price !== undefined && price < 0) throw new UserError("El precio no puede ser negativo.");
    return { variantId: asString(line.variantId, "pieza"), quantity, discount, price };
  });
}

export function parseDiscount(value: unknown): SaleDiscount | null {
  if (value === undefined || value === null) return null;
  const raw = asObject(value, "descuento");
  if (raw.kind !== "percent" && raw.kind !== "amount") throw new TypeError("Tipo de descuento no válido.");
  const amount = asInteger(raw.value, "descuento");
  return amount === 0 ? null : { kind: raw.kind, value: amount };
}

/**
 * Registra una venta completa: sus líneas, lo que sale del inventario y el dinero que
 * entra. Todo ocurre en una sola transacción: o queda la venta entera, o no queda nada.
 * Los precios, los impuestos y las tasas se toman de la base de datos, no de lo que mande
 * la pantalla.
 */
export function createSale(db: Db, value: unknown, settings: SaleSettings, now = new Date()): Sale {
  const input = asObject(value, "venta");
  const currency = settings["store.currency"];
  const prefix = settings["device.prefix"];

  const requested = parseLines(input.lines);
  if (requested.length === 0) throw new UserError("La venta no tiene productos.");
  const discount = parseDiscount(input.discount);
  const customerId = input.customerId === undefined || input.customerId === null ? null : asString(input.customerId, "cliente");
  const note = asText(input.note ?? "", "la nota", SALE_NOTE_MAX);
  const rawPayments = asArray(input.payments, "pagos").map((item) => {
    const raw = asObject(item, "pago");
    return {
      methodId: asString(raw.methodId, "medio de pago"),
      amount: asInteger(raw.amount, "monto"),
      note: asText(raw.note, "la referencia", PAYMENT_NOTE_MAX),
    };
  });
  const rawChange = asArray(input.change, "vuelto").map((item) => {
    const raw = asObject(item, "vuelto");
    return { methodId: asString(raw.methodId, "medio de pago"), amount: asInteger(raw.amount, "monto") };
  });
  if ([...rawPayments, ...rawChange].some((entry) => entry.amount <= 0)) {
    throw new UserError("Los montos de pago y de vuelto deben ser mayores que cero.");
  }
  const expectedTotal = asInteger(input.expectedTotal, "total");

  return transaction(db, () => {
    const sessionId = requireOpenSession(db);
    const ratesState = getRatesState(db, now);
    if (!ratesState.confirmedToday) throw new UserError("Confirma la tasa de hoy antes de vender.");
    const table = rateTable(ratesState);

    const customer = customerId === null ? null : findCustomer(db, customerId);
    if (customerId !== null && (!customer || !customer.active)) {
      throw new UserError("Ese cliente ya no existe. Quítalo de la venta o elige otro.");
    }

    // Cada tasa de impuesto se lee una vez. Un producto con una tasa que ya no existe lleva la general.
    const taxClasses = new Map<string, TaxClass>();
    const taxOf = (id: string): TaxClass | null => {
      if (!settings["tax.enabled"]) return null;
      const known = taxClasses.get(id);
      if (known) return known;
      const found = findTaxClass(db, id) ?? findTaxClass(db, DEFAULT_TAX_CLASS);
      if (!found) throw new UserError("No hay ninguna tasa de impuesto. Revisa los impuestos en Ajustes.");
      taxClasses.set(id, found);
      return found;
    };

    const items = requested.map((line) => {
      const item = getSaleItem(db, line.variantId);
      if (item.currency !== currency) {
        throw new UserError(`«${item.description}» tiene el precio en otra moneda. Revisa el producto.`);
      }
      let unitPrice = item.unitPrice;
      if (item.openPrice) {
        if (line.price === undefined) throw new UserError(`Escribe el precio de «${item.description}».`);
        unitPrice = line.price;
      }
      return { ...line, item, unitPrice, tax: taxOf(item.taxClass) };
    });

    let pricing;
    try {
      pricing = price(
        items.map((line) => ({
          unitPrice: line.unitPrice,
          quantity: line.quantity,
          discount: line.discount,
          tax: line.tax ? { id: line.tax.id, rate: line.tax.rate } : null,
        })),
        discount,
        settings["tax.included"]
      );
    } catch (error) {
      if (error instanceof PricingError) throw new UserError(error.message);
      throw error;
    }
    const total = pricing.total;
    if (!Number.isSafeInteger(total)) throw new UserError("El total de la venta es demasiado grande.");
    if (total !== expectedTotal) {
      throw new UserError("Los precios cambiaron mientras cobrabas. Revisa la venta y vuelve a cobrar.");
    }

    const payments = rawPayments.map((p) => ({ ...p, method: activeMethod(db, p.methodId) }));
    const change = rawChange.map((c) => ({ ...c, method: activeMethod(db, c.methodId) }));
    const result = settle(
      money(total, currency),
      payments.map((p) => ({ ...p, currency: p.method.currency })),
      change.map((c) => ({ ...c, currency: c.method.currency, note: "" })),
      table
    );
    if (result.due > 0) throw new UserError("Todavía falta dinero por cobrar. Revisa los pagos.");
    if (!result.settled) throw new UserError("El vuelto no cuadra con lo cobrado. Revisa el vuelto.");

    const saleId = randomUUID();
    const stamp = now.toISOString();
    const next = db.prepare("SELECT COALESCE(MAX(seq), 0) + 1 AS seq FROM sales WHERE prefix = ?").get(prefix) as { seq: number };
    db.prepare(
      `INSERT INTO sales
         (id, prefix, seq, session_id, currency, total, rates, created_at,
          customer_id, customer_name, customer_doc, discount, discount_percent, tax, tax_included, note)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      saleId,
      prefix,
      next.seq,
      sessionId,
      currency,
      total,
      JSON.stringify(table),
      stamp,
      customer?.id ?? null,
      customer?.name ?? "",
      customer?.doc ?? "",
      pricing.discount,
      discount?.kind === "percent" ? discount.value : null,
      pricing.tax,
      settings["tax.included"] ? 1 : 0,
      note
    );

    const insertLine = db.prepare(
      `INSERT INTO sale_lines
         (id, sale_id, variant_id, description, quantity, unit_price, total, position,
          kind, discount, share, tax_class, tax_code, tax_rate, tax, unit_cost)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    items.forEach((line, position) => {
      const priced = pricing.lines[position];
      if (!priced) throw new Error("La cuenta no tiene todas las líneas.");
      insertLine.run(
        randomUUID(),
        saleId,
        line.variantId,
        line.item.description,
        line.quantity,
        line.unitPrice,
        priced.total,
        position,
        line.item.kind,
        priced.discount,
        priced.share,
        line.tax?.id ?? "",
        line.tax?.code ?? "",
        line.tax?.rate ?? null,
        priced.tax,
        line.item.unitCost
      );
    });

    const insertTax = db.prepare(
      "INSERT INTO sale_taxes (sale_id, class_id, name, code, rate, base, tax, position) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    );
    pricing.taxes.forEach((tax, position) => {
      const taxClass = taxClasses.get(tax.id);
      insertTax.run(saleId, tax.id, taxClass?.name ?? "", taxClass?.code ?? "", tax.rate, tax.base, tax.tax, position);
    });

    recordSaleStock(
      db,
      saleId,
      items.map((line) => ({ variantId: line.variantId, quantity: line.quantity, kind: line.item.kind })),
      stamp
    );

    const rateOf = (code: CurrencyCode): number | null => (code === table.pivot ? null : (table.rates[code] ?? null));
    const movements: SaleMoney[] = [
      ...result.payments.map((p) => ({
        methodId: p.methodId,
        kind: "cobro" as const,
        amount: p.amount,
        currency: p.currency,
        rate: rateOf(p.currency),
        baseAmount: p.base,
        baseCurrency: currency,
        note: p.note,
      })),
      ...result.change.map((c) => ({
        methodId: c.methodId,
        kind: "vuelto" as const,
        amount: -c.amount,
        currency: c.currency,
        rate: rateOf(c.currency),
        baseAmount: -c.base,
        baseCurrency: currency,
        note: "",
      })),
    ];
    recordSaleMoney(db, sessionId, saleId, movements, stamp);

    return getSale(db, saleId);
  });
}

const SALE_COLUMNS = `id, prefix, seq, currency, total, rates, created_at, customer_id, customer_name, customer_doc,
                      discount, discount_percent, tax, tax_included, note`;

/** La venta tal como quedó registrada, para mostrarla o imprimir su recibo. */
export function getSale(db: Db, idValue: unknown): Sale {
  const id = asString(idValue, "venta");
  const row = db.prepare(`SELECT ${SALE_COLUMNS} FROM sales WHERE id = ?`).get(id) as SaleRow | undefined;
  if (!row) throw new UserError("Esa venta no existe.");

  const lines = db
    .prepare(
      `SELECT description, kind, quantity, unit_price, total, discount, share, tax_code, tax_rate, tax
       FROM sale_lines WHERE sale_id = ? ORDER BY position`
    )
    .all(id) as Array<{
    description: string;
    kind: string;
    quantity: number;
    unit_price: number;
    total: number;
    discount: number;
    share: number;
    tax_code: string;
    tax_rate: number | null;
    tax: number;
  }>;
  const taxes = db
    .prepare("SELECT class_id, name, code, rate, base, tax FROM sale_taxes WHERE sale_id = ? ORDER BY position")
    .all(id) as Array<{ class_id: string; name: string; code: string; rate: number; base: number; tax: number }>;
  const moneyRows = db
    .prepare(
      `SELECT m.kind, m.amount, m.currency, m.note, p.name
       FROM money_movements m JOIN payment_methods p ON p.id = m.method_id
       WHERE m.sale_id = ? ORDER BY m.rowid`
    )
    .all(id) as Array<{ kind: string; amount: number; currency: string; note: string; name: string }>;
  const of = (kind: string): SaleMoneyLine[] =>
    moneyRows
      .filter((m) => m.kind === kind)
      .map((m) => ({ methodName: m.name, currency: m.currency as CurrencyCode, amount: Math.abs(m.amount), note: m.note }));

  return {
    id: row.id,
    number: saleNumber(row.prefix, row.seq),
    createdAt: row.created_at,
    currency: row.currency as CurrencyCode,
    subtotal: lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0),
    lineDiscounts: lines.reduce((sum, l) => sum + l.discount, 0),
    discount: row.discount,
    discountPercent: row.discount_percent,
    tax: row.tax,
    taxIncluded: row.tax_included === 1,
    taxes: taxes.map((t) => ({ id: t.class_id, name: t.name, code: t.code, rate: t.rate, base: t.base, tax: t.tax })),
    total: row.total,
    rates: JSON.parse(row.rates) as RateTable,
    lines: lines.map((l) => ({
      description: l.description,
      kind: l.kind as ProductKind,
      quantity: l.quantity,
      unitPrice: l.unit_price,
      discount: l.discount,
      share: l.share,
      total: l.total,
      taxCode: l.tax_code,
      taxRate: l.tax_rate,
      tax: l.tax,
    })),
    customer: row.customer_id ? { id: row.customer_id, name: row.customer_name, doc: row.customer_doc } : null,
    note: row.note,
    payments: of("cobro"),
    change: of("vuelto"),
  };
}

const INFO = `
  SELECT s.id, s.prefix, s.seq, s.currency, s.total, s.created_at, s.customer_name,
         (SELECT COALESCE(SUM(l.quantity), 0) FROM sale_lines l WHERE l.sale_id = s.id) AS pieces
  FROM sales s
`;

type InfoRow = Pick<SaleRow, "id" | "prefix" | "seq" | "currency" | "total" | "created_at" | "customer_name"> & { pieces: number };

const toInfo = (row: InfoRow): SaleInfo => ({
  id: row.id,
  number: saleNumber(row.prefix, row.seq),
  createdAt: row.created_at,
  currency: row.currency as CurrencyCode,
  total: row.total,
  pieces: row.pieces,
  customerName: row.customer_name,
});

/** Las ventas de una caja, de la más reciente a la más antigua. */
export function salesOfSession(db: Db, sessionValue: unknown): SaleInfo[] {
  const rows = db
    .prepare(`${INFO} WHERE s.session_id = ? ORDER BY s.created_at DESC, s.seq DESC`)
    .all(asString(sessionValue, "caja")) as unknown as InfoRow[];
  return rows.map(toInfo);
}

/** El instante en que empieza un día de la tienda (hora del equipo), como texto ISO. */
function dayStart(value: unknown, what: string, offsetDays = 0): string {
  const text = asString(value, what);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) throw new TypeError(`Fecha no válida en ${what}.`);
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + offsetDays);
  if (Number.isNaN(date.getTime())) throw new TypeError(`Fecha no válida en ${what}.`);
  return date.toISOString();
}

/** El historial de ventas: por fechas, por cliente, o buscando un número de venta o un nombre. */
export function listSales(db: Db, filterValue: unknown = {}): SalesPage {
  const filter = asObject(filterValue, "filtro");
  const conditions: string[] = [];
  const values: Array<string | number> = [];

  if (filter.from !== undefined && filter.from !== null) {
    conditions.push("s.created_at >= ?");
    values.push(dayStart(filter.from, "desde"));
  }
  if (filter.to !== undefined && filter.to !== null) {
    conditions.push("s.created_at < ?");
    values.push(dayStart(filter.to, "hasta", 1));
  }
  if (filter.customerId !== undefined && filter.customerId !== null) {
    conditions.push("s.customer_id = ?");
    values.push(asString(filter.customerId, "cliente"));
  }
  const query = filter.query === undefined ? "" : normalize(asString(filter.query, "búsqueda"));
  for (const term of query.split(" ").filter(Boolean).slice(0, 6)) {
    // Cada palabra debe estar en el número de la venta o en el nombre del cliente.
    conditions.push("(lower(printf('%s-%06d', s.prefix, s.seq)) LIKE ? ESCAPE '\\' OR vm_normalize(s.customer_name) LIKE ? ESCAPE '\\')");
    const like = `%${term.replace(/[\\%_]/g, "\\$&")}%`;
    values.push(like, like);
  }
  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db.prepare(`${INFO} ${where} ORDER BY s.created_at DESC, s.seq DESC LIMIT ?`).all(...values, HISTORY_LIMIT) as unknown as InfoRow[];
  const sums = db
    .prepare(`SELECT s.currency, COUNT(*) AS n, SUM(s.total) AS total FROM sales s ${where} GROUP BY s.currency`)
    .all(...values) as Array<{ currency: string; n: number; total: number }>;
  const totals: Money[] = sums.map((row) => money(row.total, row.currency as CurrencyCode));

  return { sales: rows.map(toInfo), count: sums.reduce((sum, row) => sum + row.n, 0), totals };
}
