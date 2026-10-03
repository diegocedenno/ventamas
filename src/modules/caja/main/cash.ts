import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { money, type CurrencyCode, type Money } from "@shared/money";
import { asArray, asBoolean, asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import {
  NOTE_MAX,
  REASON_MAX,
  type MethodTotals,
  type PaymentMethod,
  type SessionInfo,
  type SessionSummary,
} from "../api";

interface MethodRow {
  id: string;
  name: string;
  currency: string;
  kind: string;
  active: number;
}

interface SessionRow {
  id: string;
  opened_at: string;
  closed_at: string | null;
  note: string;
}

const toMethod = (row: MethodRow): PaymentMethod => ({
  id: row.id,
  name: row.name,
  currency: row.currency as CurrencyCode,
  kind: row.kind as PaymentMethod["kind"],
  active: row.active === 1,
});

/* ---------- medios de pago ---------- */

export function listMethods(db: Db): PaymentMethod[] {
  const rows = db
    .prepare("SELECT id, name, currency, kind, active FROM payment_methods ORDER BY position")
    .all() as unknown as MethodRow[];
  return rows.map(toMethod);
}

export function getMethod(db: Db, id: string): PaymentMethod {
  const row = db.prepare("SELECT id, name, currency, kind, active FROM payment_methods WHERE id = ?").get(id) as
    | MethodRow
    | undefined;
  if (!row) throw new UserError("Ese medio de pago no existe.");
  return toMethod(row);
}

function activeMethod(db: Db, id: string): PaymentMethod {
  const method = getMethod(db, id);
  if (!method.active) throw new UserError(`«${method.name}» está desactivado. Actívalo en Ajustes para usarlo.`);
  return method;
}

export function setMethodActive(db: Db, idValue: unknown, activeValue: unknown): PaymentMethod[] {
  const id = asString(idValue, "medio de pago");
  const active = asBoolean(activeValue);
  getMethod(db, id);
  if (!active) {
    const left = db.prepare("SELECT COUNT(*) AS n FROM payment_methods WHERE active = 1 AND id <> ?").get(id) as { n: number };
    if (left.n === 0) throw new UserError("Tiene que quedar al menos un medio de pago activo.");
  }
  db.prepare("UPDATE payment_methods SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  return listMethods(db);
}

/* ---------- la caja ---------- */

function openRow(db: Db): SessionRow | undefined {
  return db.prepare("SELECT id, opened_at, closed_at, note FROM cash_sessions WHERE closed_at IS NULL").get() as
    | SessionRow
    | undefined;
}

/** La caja abierta. Lanza UserError si está cerrada: sin caja no se mueve dinero. */
export function requireOpenSession(db: Db): string {
  const row = openRow(db);
  if (!row) throw new UserError("La caja está cerrada. Ábrela para continuar.");
  return row.id;
}

const INSERT_MOVEMENT = `
  INSERT INTO money_movements
    (id, session_id, method_id, kind, amount, currency, rate, sale_id, base_amount, base_currency, note, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

/** Abre la caja con el fondo inicial de cada medio en efectivo. */
export function openSession(db: Db, value: unknown, now = new Date()): SessionSummary {
  const input = asObject(value, "apertura");
  const floats = asArray(input.floats, "fondos").map((item) => {
    const raw = asObject(item, "fondo");
    const method = activeMethod(db, asString(raw.methodId, "medio de pago"));
    const amount = asInteger(raw.amount, "fondo");
    if (method.kind !== "efectivo") throw new TypeError("El fondo inicial solo aplica al efectivo.");
    if (amount < 0) throw new UserError("El fondo inicial no puede ser negativo.");
    return { method, amount };
  });
  if (new Set(floats.map((f) => f.method.id)).size !== floats.length) throw new TypeError("Fondo repetido.");

  return transaction(db, () => {
    if (openRow(db)) throw new UserError("La caja ya está abierta.");
    const id = randomUUID();
    const stamp = now.toISOString();
    db.prepare("INSERT INTO cash_sessions (id, opened_at) VALUES (?, ?)").run(id, stamp);
    const insert = db.prepare(INSERT_MOVEMENT);
    for (const { method, amount } of floats) {
      if (amount === 0) continue;
      insert.run(randomUUID(), id, method.id, "apertura", amount, method.currency, null, null, null, null, "", stamp);
    }
    return sessionSummary(db, id);
  });
}

/** Entrada o salida de efectivo a mano, con su motivo (un retiro, un pago menor, cambio de billetes). */
export function addMovement(db: Db, value: unknown, now = new Date()): SessionSummary {
  const input = asObject(value, "movimiento");
  const kind = input.kind;
  if (kind !== "entrada" && kind !== "salida") throw new TypeError("Tipo de movimiento no válido.");
  const amount = asInteger(input.amount, "monto");
  if (amount <= 0) throw new UserError("Escribe un monto mayor que cero.");
  const reason = asText(input.reason, "el motivo", REASON_MAX, true);

  return transaction(db, () => {
    const sessionId = requireOpenSession(db);
    const method = activeMethod(db, asString(input.methodId, "medio de pago"));
    db.prepare(INSERT_MOVEMENT).run(
      randomUUID(),
      sessionId,
      method.id,
      kind,
      kind === "salida" ? -amount : amount,
      method.currency,
      null,
      null,
      null,
      null,
      reason,
      now.toISOString()
    );
    return sessionSummary(db, sessionId);
  });
}

export interface SaleMoney {
  methodId: string;
  kind: "cobro" | "vuelto";
  /** Con signo: los vueltos son negativos. */
  amount: number;
  currency: CurrencyCode;
  rate: number | null;
  baseAmount: number;
  baseCurrency: CurrencyCode;
  note: string;
}

/** Registra los cobros y vueltos de una venta. Se llama dentro de la transacción de la venta. */
export function recordSaleMoney(db: Db, sessionId: string, saleId: string, movements: readonly SaleMoney[], stamp: string): void {
  const insert = db.prepare(INSERT_MOVEMENT);
  for (const m of movements) {
    insert.run(
      randomUUID(),
      sessionId,
      m.methodId,
      m.kind,
      m.amount,
      m.currency,
      m.rate,
      saleId,
      m.baseAmount,
      m.baseCurrency,
      m.note,
      stamp
    );
  }
}

export function sessionSummary(db: Db, idValue: unknown): SessionSummary {
  const id = asString(idValue, "caja");
  const session = db.prepare("SELECT id, opened_at, closed_at, note FROM cash_sessions WHERE id = ?").get(id) as
    | SessionRow
    | undefined;
  if (!session) throw new UserError("Esa caja no existe.");

  const sums = db
    .prepare("SELECT method_id, kind, SUM(amount) AS total FROM money_movements WHERE session_id = ? GROUP BY method_id, kind")
    .all(id) as Array<{ method_id: string; kind: string; total: number }>;
  const counts = new Map(
    (
      db.prepare("SELECT method_id, expected, counted FROM cash_counts WHERE session_id = ?").all(id) as Array<{
        method_id: string;
        expected: number;
        counted: number;
      }>
    ).map((row) => [row.method_id, row])
  );

  const totals: MethodTotals[] = [];
  for (const method of listMethods(db)) {
    const of = (kind: string) => sums.find((s) => s.method_id === method.id && s.kind === kind)?.total ?? 0;
    const opening = of("apertura");
    const moves = of("entrada") + of("salida");
    const sales = of("cobro");
    const change = of("vuelto");
    const used = sums.some((s) => s.method_id === method.id);
    const count = counts.get(method.id);
    // Un medio desactivado solo aparece si llegó a moverse en esta caja.
    if (!used && !count && !method.active) continue;
    totals.push({
      method,
      opening,
      moves,
      sales,
      change,
      // Una caja cerrada muestra lo esperado tal como quedó al cerrarla.
      expected: count?.expected ?? opening + moves + sales + change,
      counted: count?.counted ?? null,
    });
  }

  const sold = db
    .prepare(
      `SELECT base_currency, SUM(base_amount) AS total FROM money_movements
       WHERE session_id = ? AND sale_id IS NOT NULL GROUP BY base_currency`
    )
    .all(id) as Array<{ base_currency: string; total: number }>;
  const salesTotals: Money[] = sold.map((row) => money(row.total, row.base_currency as CurrencyCode));
  const salesCount = (
    db.prepare("SELECT COUNT(DISTINCT sale_id) AS n FROM money_movements WHERE session_id = ? AND sale_id IS NOT NULL").get(id) as {
      n: number;
    }
  ).n;

  return { id, openedAt: session.opened_at, closedAt: session.closed_at, note: session.note, totals, salesCount, salesTotals };
}

/** La caja abierta con su resumen, o null si está cerrada. */
export function currentSession(db: Db): SessionSummary | null {
  const row = openRow(db);
  return row ? sessionSummary(db, row.id) : null;
}

/**
 * Cierra la caja con lo contado de cada medio. Lo esperado se guarda junto a lo contado,
 * así el cierre se puede revisar después tal como fue.
 */
export function closeSession(db: Db, value: unknown, now = new Date()): SessionSummary {
  const input = asObject(value, "cierre");
  const note = asText(input.note, "la nota", NOTE_MAX);
  const counted = new Map<string, number>();
  for (const item of asArray(input.counts, "conteo")) {
    const raw = asObject(item, "conteo");
    const amount = asInteger(raw.counted, "conteo");
    if (amount < 0) throw new UserError("Lo contado no puede ser negativo.");
    counted.set(asString(raw.methodId, "medio de pago"), amount);
  }

  return transaction(db, () => {
    const sessionId = requireOpenSession(db);
    const summary = sessionSummary(db, sessionId);
    const insert = db.prepare("INSERT INTO cash_counts (session_id, method_id, expected, counted) VALUES (?, ?, ?, ?)");
    for (const line of summary.totals) {
      const amount = counted.get(line.method.id);
      if (amount === undefined) {
        // Lo que no se movió y no se contó queda en cero; lo que sí se movió hay que contarlo.
        if (line.expected === 0) continue;
        throw new UserError(`Falta contar «${line.method.name}».`);
      }
      insert.run(sessionId, line.method.id, line.expected, amount);
    }
    db.prepare("UPDATE cash_sessions SET closed_at = ?, note = ? WHERE id = ?").run(now.toISOString(), note, sessionId);
    return sessionSummary(db, sessionId);
  });
}

export function listSessions(db: Db, limit = 30): SessionInfo[] {
  const rows = db
    .prepare(
      `SELECT s.id, s.opened_at, s.closed_at,
              (SELECT COUNT(DISTINCT m.sale_id) FROM money_movements m WHERE m.session_id = s.id AND m.sale_id IS NOT NULL) AS sales
       FROM cash_sessions s ORDER BY s.opened_at DESC LIMIT ?`
    )
    .all(limit) as unknown as Array<SessionRow & { sales: number }>;
  return rows.map((row) => ({ id: row.id, openedAt: row.opened_at, closedAt: row.closed_at, salesCount: row.sales }));
}
