import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { normalize } from "@shared/text";
import { asBoolean, asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import { DEFAULT_TAX_CLASS, TAX_CODE_MAX, TAX_NAME_MAX, TAX_RATE_MAX, type TaxClass } from "../api";

interface TaxRow {
  id: string;
  name: string;
  code: string;
  rate: number;
  active: number;
}

const toTaxClass = (row: TaxRow): TaxClass => ({
  id: row.id,
  name: row.name,
  code: row.code,
  rate: row.rate,
  active: row.active === 1,
});

export function listTaxClasses(db: Db): TaxClass[] {
  const rows = db.prepare("SELECT id, name, code, rate, active FROM tax_classes ORDER BY position, rowid").all() as unknown as TaxRow[];
  return rows.map(toTaxClass);
}

/** La tasa con ese identificador, esté activa o no; undefined si no existe. */
export function findTaxClass(db: Db, id: string): TaxClass | undefined {
  const row = db.prepare("SELECT id, name, code, rate, active FROM tax_classes WHERE id = ?").get(id) as TaxRow | undefined;
  return row ? toTaxClass(row) : undefined;
}

/** Crea una tasa o cambia una que ya existe. La tasa general no se puede desactivar. */
export function saveTaxClass(db: Db, value: unknown): TaxClass[] {
  const input = asObject(value, "impuesto");
  const id = input.id === undefined ? undefined : asString(input.id, "impuesto");
  const name = asText(input.name, "el nombre del impuesto", TAX_NAME_MAX, true);
  const code = asText(input.code, "la letra del impuesto", TAX_CODE_MAX).toUpperCase();
  const rate = asInteger(input.rate, "tasa");
  const active = asBoolean(input.active);
  if (rate < 0 || rate > TAX_RATE_MAX) throw new UserError("La tasa va de 0 a 100 %.");
  if (id === DEFAULT_TAX_CLASS && !active) {
    throw new UserError("La tasa general no se puede desactivar: es la que llevan los productos nuevos.");
  }

  return transaction(db, () => {
    const clash = listTaxClasses(db).find((tax) => tax.id !== id && normalize(tax.name) === normalize(name));
    if (clash) throw new UserError(`Ya hay un impuesto llamado «${clash.name}».`);

    if (id === undefined) {
      const next = db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS position FROM tax_classes").get() as { position: number };
      db.prepare("INSERT INTO tax_classes (id, name, code, rate, active, position) VALUES (?, ?, ?, ?, ?, ?)").run(
        randomUUID(),
        name,
        code,
        rate,
        active ? 1 : 0,
        next.position
      );
    } else {
      const result = db
        .prepare("UPDATE tax_classes SET name = ?, code = ?, rate = ?, active = ? WHERE id = ?")
        .run(name, code, rate, active ? 1 : 0, id);
      if (result.changes === 0) throw new UserError("Ese impuesto ya no existe.");
    }
    return listTaxClasses(db);
  });
}
