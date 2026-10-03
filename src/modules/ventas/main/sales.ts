import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { money, type CurrencyCode, type RateTable } from "@shared/money";
import type { Settings } from "@shared/settings";
import { asArray, asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import { getMethod, recordSaleMoney, requireOpenSession, type SaleMoney } from "../../caja/main/cash";
import { getSaleItem, recordSaleStock } from "../../inventario/main/products";
import { getRatesState, rateTable } from "../../monedas/main/rates";
import { MAX_LINES, MAX_QUANTITY, PAYMENT_NOTE_MAX, type Sale, type SaleInfo, type SaleMoneyLine } from "../api";
import { settle } from "../settlement";

export const saleNumber = (prefix: string, seq: number): string => `${prefix}-${String(seq).padStart(6, "0")}`;

interface SaleRow {
  id: string;
  prefix: string;
  seq: number;
  currency: string;
  total: number;
  rates: string;
  created_at: string;
}

function activeMethod(db: Db, id: string) {
  const method = getMethod(db, id);
  if (!method.active) throw new UserError(`«${method.name}» está desactivado. Quítalo de la venta y usa otro medio de pago.`);
  return method;
}

/**
 * Registra una venta completa: sus líneas, lo que sale del inventario y el dinero que
 * entra. Todo ocurre en una sola transacción: o queda la venta entera, o no queda nada.
 * Los precios y las tasas se toman de la base de datos, no de lo que mande la pantalla.
 */
export function createSale(
  db: Db,
  value: unknown,
  settings: Pick<Settings, "store.currency" | "device.prefix">,
  now = new Date()
): Sale {
  const input = asObject(value, "venta");
  const currency = settings["store.currency"];
  const prefix = settings["device.prefix"];

  const rawLines = asArray(input.lines, "líneas");
  if (rawLines.length === 0) throw new UserError("La venta no tiene productos.");
  if (rawLines.length > MAX_LINES) throw new UserError(`Una venta no puede tener más de ${MAX_LINES} líneas.`);
  const requested = rawLines.map((item) => {
    const raw = asObject(item, "línea");
    const quantity = asInteger(raw.quantity, "cantidad");
    if (quantity < 1 || quantity > MAX_QUANTITY) throw new UserError(`La cantidad va de 1 a ${MAX_QUANTITY}.`);
    return { variantId: asString(raw.variantId, "pieza"), quantity };
  });
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

    const lines = requested.map(({ variantId, quantity }) => {
      const item = getSaleItem(db, variantId);
      if (item.currency !== currency) {
        throw new UserError(`«${item.description}» tiene el precio en otra moneda. Revisa el producto.`);
      }
      return { variantId, quantity, description: item.description, unitPrice: item.unitPrice, total: item.unitPrice * quantity };
    });
    const total = lines.reduce((sum, line) => sum + line.total, 0);
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
      "INSERT INTO sales (id, prefix, seq, session_id, currency, total, rates, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(saleId, prefix, next.seq, sessionId, currency, total, JSON.stringify(table), stamp);

    const insertLine = db.prepare(
      `INSERT INTO sale_lines (id, sale_id, variant_id, description, quantity, unit_price, total, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    lines.forEach((line, position) => {
      insertLine.run(randomUUID(), saleId, line.variantId, line.description, line.quantity, line.unitPrice, line.total, position);
    });
    recordSaleStock(db, saleId, lines, stamp);

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

/** La venta tal como quedó registrada, para mostrarla o imprimir su recibo. */
export function getSale(db: Db, idValue: unknown): Sale {
  const id = asString(idValue, "venta");
  const row = db.prepare("SELECT id, prefix, seq, currency, total, rates, created_at FROM sales WHERE id = ?").get(id) as
    | SaleRow
    | undefined;
  if (!row) throw new UserError("Esa venta no existe.");

  const lines = db
    .prepare("SELECT description, quantity, unit_price, total FROM sale_lines WHERE sale_id = ? ORDER BY position")
    .all(id) as Array<{ description: string; quantity: number; unit_price: number; total: number }>;
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
    total: row.total,
    rates: JSON.parse(row.rates) as RateTable,
    lines: lines.map((l) => ({ description: l.description, quantity: l.quantity, unitPrice: l.unit_price, total: l.total })),
    payments: of("cobro"),
    change: of("vuelto"),
  };
}

/** Las ventas de una caja, de la más reciente a la más antigua. */
export function salesOfSession(db: Db, sessionValue: unknown): SaleInfo[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.prefix, s.seq, s.currency, s.total, s.created_at,
              (SELECT SUM(l.quantity) FROM sale_lines l WHERE l.sale_id = s.id) AS pieces
       FROM sales s WHERE s.session_id = ? ORDER BY s.created_at DESC, s.seq DESC`
    )
    .all(asString(sessionValue, "caja")) as unknown as Array<SaleRow & { pieces: number }>;
  return rows.map((row) => ({
    id: row.id,
    number: saleNumber(row.prefix, row.seq),
    createdAt: row.created_at,
    currency: row.currency as CurrencyCode,
    total: row.total,
    pieces: row.pieces,
  }));
}
