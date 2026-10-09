// Existencias: los movimientos que una persona registra a mano (llegó mercancía, se
// contó, se dañó, se perdió), el historial de un producto y las cifras del inventario.
// Las ventas registran sus propias salidas desde products.ts.

import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { proportion, type CurrencyCode } from "@shared/money";
import { asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import {
  MAX_STOCK,
  STOCK_NOTE_MAX,
  STOCK_REASONS,
  variantLabel,
  type InventorySummary,
  type Product,
  type StockMovement,
  type StockReason,
} from "../api";
import { getProduct, VARIANTS_WITH_STOCK } from "./products";

function asReason(value: unknown): StockReason {
  if (typeof value === "string" && (STOCK_REASONS as readonly string[]).includes(value)) return value as StockReason;
  throw new TypeError("Motivo de movimiento no válido.");
}

/**
 * Registra un movimiento de existencias con su motivo. Una entrada con costo actualiza el
 * costo del producto como promedio ponderado de lo que había y lo que llega.
 */
export function moveStock(db: Db, value: unknown, now = new Date()): Product {
  const input = asObject(value, "movimiento");
  const variantId = asString(input.variantId, "pieza");
  const reason = asReason(input.reason);
  const quantity = asInteger(input.quantity, "cantidad");
  const note = asText(input.note ?? "", "la nota", STOCK_NOTE_MAX);
  const unitCost = input.unitCost === undefined || input.unitCost === null ? null : asInteger(input.unitCost, "costo");
  if (quantity < 0 || (quantity === 0 && reason !== "conteo")) throw new UserError("Escribe una cantidad mayor que cero.");
  if (quantity > MAX_STOCK) throw new UserError("La cantidad no puede pasar de un millón de piezas.");
  if (unitCost !== null && unitCost < 0) throw new UserError("El costo no puede ser negativo.");
  if (unitCost !== null && reason !== "entrada") throw new TypeError("El costo solo aplica a una entrada.");

  return transaction(db, () => {
    const row = db.prepare(`${VARIANTS_WITH_STOCK} WHERE v.id = ?`).get(variantId) as
      | { id: string; product_id: string; stock: number; cost: number | null; active: number }
      | undefined;
    if (!row || row.active === 0) throw new UserError("Esa pieza ya no existe. Cierra y vuelve a abrir el producto.");
    const product = db.prepare("SELECT kind, cost FROM products WHERE id = ?").get(row.product_id) as { kind: string; cost: number | null };
    if (product.kind === "servicio") throw new UserError("Un servicio no lleva existencias.");

    const change = reason === "entrada" ? quantity : reason === "conteo" ? quantity - row.stock : -quantity;
    if (change === 0) return getProduct(db, row.product_id);

    if (unitCost !== null) {
      // Costo promedio: lo que había, a su costo, más lo que llega, al suyo. Las piezas
      // sin costo propio comparten el del producto, y cuentan juntas.
      if (row.cost !== null) {
        const had = Math.max(row.stock, 0);
        const average = proportion(had * row.cost + quantity * unitCost, 1, had + quantity);
        db.prepare("UPDATE variants SET cost = ? WHERE id = ?").run(average, variantId);
      } else {
        const shared = db
          .prepare(
            `SELECT COALESCE(SUM(MAX(s.stock, 0)), 0) AS n
             FROM (${VARIANTS_WITH_STOCK} WHERE v.product_id = ? AND v.active = 1 AND v.cost IS NULL) s`
          )
          .get(row.product_id) as { n: number };
        const average =
          product.cost === null ? unitCost : proportion(shared.n * product.cost + quantity * unitCost, 1, shared.n + quantity);
        db.prepare("UPDATE products SET cost = ?, updated_at = ? WHERE id = ?").run(average, now.toISOString(), row.product_id);
      }
    }

    db.prepare(
      "INSERT INTO stock_movements (id, variant_id, quantity, reason, note, unit_cost, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ).run(randomUUID(), variantId, change, reason, note, unitCost, now.toISOString());
    return getProduct(db, row.product_id);
  });
}

/** Los últimos movimientos de un producto, del más reciente al más antiguo, con lo que quedó tras cada uno. */
export function listMovements(db: Db, productValue: unknown, limit = 200): StockMovement[] {
  const rows = db
    .prepare(
      `SELECT * FROM (
         SELECT m.id, m.rowid AS n, v.value1, v.value2, m.quantity, m.reason, m.note, m.created_at,
                SUM(m.quantity) OVER (PARTITION BY m.variant_id ORDER BY m.created_at, m.rowid) AS balance
         FROM stock_movements m JOIN variants v ON v.id = m.variant_id
         WHERE v.product_id = ?
       ) ORDER BY created_at DESC, n DESC LIMIT ?`
    )
    .all(asString(productValue, "producto"), limit) as Array<{
    id: string;
    value1: string;
    value2: string;
    quantity: number;
    reason: string;
    note: string;
    balance: number;
    created_at: string;
  }>;
  return rows.map((row) => ({
    id: row.id,
    variant: variantLabel(row),
    quantity: row.quantity,
    reason: row.reason,
    note: row.note,
    balance: row.balance,
    createdAt: row.created_at,
  }));
}

/** Las cifras del inventario: cuánto hay, cuánto vale y qué pide atención. */
export function inventorySummary(db: Db, currency: CurrencyCode): InventorySummary {
  const counts = db
    .prepare(
      `SELECT COALESCE(SUM(kind = 'producto'), 0) AS products, COALESCE(SUM(kind = 'servicio'), 0) AS services
       FROM products WHERE active = 1`
    )
    .get() as { products: number; services: number };

  const stock = db
    .prepare(
      `SELECT COALESCE(SUM(pieces), 0) AS pieces,
              COALESCE(SUM(sale_value), 0) AS sale_value,
              COALESCE(SUM(cost_value), 0) AS cost_value,
              COALESCE(SUM(pieces > 0 AND without_cost > 0), 0) AS without_cost,
              COALESCE(SUM(low > 0), 0) AS low,
              COALESCE(SUM(negative > 0), 0) AS negative
       FROM (
         SELECT SUM(MAX(s.stock, 0)) AS pieces,
                SUM(MAX(s.stock, 0) * COALESCE(s.price, p.price)) AS sale_value,
                SUM(MAX(s.stock, 0) * COALESCE(s.cost, p.cost, 0)) AS cost_value,
                SUM(s.stock > 0 AND COALESCE(s.cost, p.cost) IS NULL) AS without_cost,
                SUM(p.min_stock IS NOT NULL AND s.stock <= p.min_stock) AS low,
                SUM(s.stock < 0) AS negative
         FROM products p JOIN (${VARIANTS_WITH_STOCK} WHERE v.active = 1) s ON s.product_id = p.id
         WHERE p.active = 1 AND p.kind = 'producto'
         GROUP BY p.id
       )`
    )
    .get() as { pieces: number; sale_value: number; cost_value: number; without_cost: number; low: number; negative: number };

  return {
    products: counts.products,
    services: counts.services,
    pieces: stock.pieces,
    low: stock.low,
    negative: stock.negative,
    saleValue: stock.sale_value,
    costValue: stock.cost_value,
    withoutCost: stock.without_cost,
    currency,
  };
}

/* ---------- códigos propios ---------- */

/** Dígito de control de un EAN-13 a partir de sus doce primeras cifras. */
export function ean13CheckDigit(first12: string): number {
  if (!/^\d{12}$/.test(first12)) throw new RangeError("Un EAN-13 lleva doce cifras antes del dígito de control.");
  const sum = [...first12].reduce((total, digit, index) => total + Number(digit) * (index % 2 === 0 ? 1 : 3), 0);
  return (10 - (sum % 10)) % 10;
}

/**
 * Propone un código de barras propio que nadie más usa. Empieza por 20: los prefijos del
 * 20 al 29 están reservados para uso interno de cada tienda, así que nunca chocan con el
 * código de un fabricante. `skip` son códigos ya propuestos que aún no se han guardado.
 */
export function suggestCode(db: Db, skipValue: unknown = []): string {
  const skip = new Set(Array.isArray(skipValue) ? skipValue.filter((item): item is string => typeof item === "string") : []);
  const last = db
    .prepare("SELECT MAX(code) AS code FROM variants WHERE length(code) = 13 AND code GLOB '20[0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]'")
    .get() as { code: string | null };
  let next = last.code ? Number(last.code.slice(2, 12)) + 1 : 1;
  const used = db.prepare("SELECT 1 FROM variants WHERE code = ?");
  for (;;) {
    const body = `20${String(next).padStart(10, "0")}`;
    const code = `${body}${ean13CheckDigit(body)}`;
    if (!skip.has(code) && !used.get(code)) return code;
    next++;
  }
}
