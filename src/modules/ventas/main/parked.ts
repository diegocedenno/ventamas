// Ventas en espera: una venta a medio armar que se guarda para atender a otro cliente y
// se retoma después. Se guardan en la base de datos para que un corte de luz no las
// pierda. No son hechos: al retomarlas o descartarlas, se borran.

import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import { findCustomer } from "../../clientes/main/customers";
import { findSaleItem } from "../../inventario/main/products";
import { MAX_PARKED, PARK_LABEL_MAX, SALE_NOTE_MAX, type ParkedInfo, type ParkInput, type ResumedSale } from "../api";
import { parseDiscount, parseLines } from "./sales";

interface ParkedRow {
  id: string;
  label: string;
  data: string;
  created_at: string;
}

type ParkedData = Omit<ParkInput, "label">;

function readData(row: ParkedRow): ParkedData {
  try {
    const raw = asObject(JSON.parse(row.data), "venta en espera");
    return {
      lines: parseLines(raw.lines),
      discount: parseDiscount(raw.discount),
      customerId: typeof raw.customerId === "string" ? raw.customerId : null,
      note: typeof raw.note === "string" ? raw.note : "",
    };
  } catch {
    // Una venta en espera dañada no debe impedir usar las demás.
    return { lines: [], discount: null, customerId: null, note: "" };
  }
}

export function listParked(db: Db): ParkedInfo[] {
  const rows = db.prepare("SELECT id, label, data, created_at FROM parked_sales ORDER BY created_at DESC").all() as unknown as ParkedRow[];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    createdAt: row.created_at,
    pieces: readData(row).lines.reduce((sum, line) => sum + line.quantity, 0),
  }));
}

/** Deja una venta en espera. */
export function parkSale(db: Db, value: unknown, now = new Date()): ParkedInfo[] {
  const input = asObject(value, "venta en espera");
  const label = asText(input.label ?? "", "el nombre", PARK_LABEL_MAX);
  const data: ParkedData = {
    lines: parseLines(input.lines),
    discount: parseDiscount(input.discount),
    customerId: input.customerId === undefined || input.customerId === null ? null : asString(input.customerId, "cliente"),
    note: asText(input.note ?? "", "la nota", SALE_NOTE_MAX),
  };
  if (data.lines.length === 0) throw new UserError("La venta está vacía: no hay nada que dejar en espera.");

  return transaction(db, () => {
    const count = db.prepare("SELECT COUNT(*) AS n FROM parked_sales").get() as { n: number };
    if (count.n >= MAX_PARKED) {
      throw new UserError(`Ya hay ${MAX_PARKED} ventas en espera. Retoma o descarta alguna antes de dejar otra.`);
    }
    db.prepare("INSERT INTO parked_sales (id, label, data, created_at) VALUES (?, ?, ?, ?)").run(
      randomUUID(),
      label,
      JSON.stringify(data),
      now.toISOString()
    );
    return listParked(db);
  });
}

/**
 * Retoma una venta en espera: la devuelve con los precios y las existencias de ahora y la
 * quita de la lista. Lo que ya no se vende se deja fuera y se avisa cuántos eran.
 */
export function takeParked(db: Db, idValue: unknown): ResumedSale {
  const id = asString(idValue, "venta en espera");
  return transaction(db, () => {
    const row = db.prepare("SELECT id, label, data, created_at FROM parked_sales WHERE id = ?").get(id) as ParkedRow | undefined;
    if (!row) throw new UserError("Esa venta en espera ya no está. Puede que ya se haya retomado.");
    const data = readData(row);

    const lines: ResumedSale["lines"] = [];
    let dropped = 0;
    for (const line of data.lines) {
      const item = findSaleItem(db, line.variantId);
      if (!item) {
        dropped++;
        continue;
      }
      const unitPrice = item.openPrice ? (line.price ?? item.unitPrice) : item.unitPrice;
      lines.push({
        variantId: item.variantId,
        description: item.description,
        kind: item.kind,
        unitPrice,
        openPrice: item.openPrice,
        taxClass: item.taxClass,
        stock: item.stock,
        quantity: line.quantity,
        // Si el precio bajó, el descuento no puede quedar mayor que la línea.
        discount: Math.min(line.discount, unitPrice * line.quantity),
      });
    }
    const customer = data.customerId ? findCustomer(db, data.customerId) : undefined;

    db.prepare("DELETE FROM parked_sales WHERE id = ?").run(id);
    return {
      label: row.label,
      lines,
      dropped,
      discount: data.discount,
      customerId: customer?.active ? customer.id : null,
      note: data.note,
    };
  });
}

export function discardParked(db: Db, idValue: unknown): ParkedInfo[] {
  db.prepare("DELETE FROM parked_sales WHERE id = ?").run(asString(idValue, "venta en espera"));
  return listParked(db);
}
