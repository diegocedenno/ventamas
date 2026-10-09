import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { digitsOf, formatDoc } from "@shared/taxid";
import { normalize } from "@shared/text";
import { asBoolean, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import {
  CUSTOMER_ADDRESS_MAX,
  CUSTOMER_DOC_MAX,
  CUSTOMER_EMAIL_MAX,
  CUSTOMER_LIST_LIMIT,
  CUSTOMER_NAME_MAX,
  CUSTOMER_NOTE_MAX,
  CUSTOMER_PHONE_MAX,
  type Customer,
} from "../api";

interface CustomerRow {
  id: string;
  name: string;
  doc: string;
  phone: string;
  email: string;
  address: string;
  note: string;
  active: number;
  created_at: string;
}

const toCustomer = (row: CustomerRow): Customer => ({
  id: row.id,
  name: row.name,
  doc: row.doc,
  phone: row.phone,
  email: row.email,
  address: row.address,
  note: row.note,
  active: row.active === 1,
  createdAt: row.created_at,
});

const COLUMNS = "id, name, doc, phone, email, address, note, active, created_at";

/** Lo que se guarda para buscar: el nombre sin acentos, y documento y teléfono con y sin separadores. */
const searchText = (name: string, doc: string, phone: string): string =>
  [normalize(name), normalize(doc), digitsOf(doc), digitsOf(phone)].filter(Boolean).join(" ");

/** Busca por palabras del nombre, o por las cifras del documento o del teléfono. */
export function listCustomers(db: Db, queryValue: unknown = "", includeInactive: unknown = false, limit = CUSTOMER_LIST_LIMIT): Customer[] {
  const query = asString(queryValue, "búsqueda");
  // "0414-555.12.34" debe encontrar el teléfono guardado como "04145551234".
  const terms = normalize(query)
    .split(" ")
    .filter(Boolean)
    .slice(0, 6)
    .map((term) => (/^[\d.\-()+]+$/.test(term) && digitsOf(term) !== "" ? digitsOf(term) : term));
  const conditions = terms.map(() => "search LIKE ? ESCAPE '\\'");
  if (!asBoolean(includeInactive)) conditions.push("active = 1");
  const rows = db
    .prepare(`SELECT ${COLUMNS} FROM customers ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""} ORDER BY search LIMIT ?`)
    .all(...terms.map((term) => `%${term.replace(/[\\%_]/g, "\\$&")}%`), limit) as unknown as CustomerRow[];
  return rows.map(toCustomer);
}

export function getCustomer(db: Db, idValue: unknown): Customer {
  const row = db.prepare(`SELECT ${COLUMNS} FROM customers WHERE id = ?`).get(asString(idValue, "cliente")) as CustomerRow | undefined;
  if (!row) throw new UserError("Ese cliente ya no existe.");
  return toCustomer(row);
}

/** El cliente, o undefined si no existe. Para quien solo necesita sus datos si los hay. */
export function findCustomer(db: Db, id: string): Customer | undefined {
  const row = db.prepare(`SELECT ${COLUMNS} FROM customers WHERE id = ?`).get(id) as CustomerRow | undefined;
  return row ? toCustomer(row) : undefined;
}

export function saveCustomer(db: Db, value: unknown, now = new Date()): Customer {
  const input = asObject(value, "cliente");
  const id = input.id === undefined ? undefined : asString(input.id, "cliente");
  const name = asText(input.name, "el nombre del cliente", CUSTOMER_NAME_MAX, true);
  const doc = formatDoc(asText(input.doc ?? "", "el documento", CUSTOMER_DOC_MAX));
  const phone = asText(input.phone ?? "", "el teléfono", CUSTOMER_PHONE_MAX);
  const email = asText(input.email ?? "", "el correo", CUSTOMER_EMAIL_MAX).toLowerCase();
  const address = asText(input.address ?? "", "la dirección", CUSTOMER_ADDRESS_MAX);
  const note = asText(input.note ?? "", "la nota", CUSTOMER_NOTE_MAX);
  if (doc.length > CUSTOMER_DOC_MAX) throw new UserError(`El documento no puede pasar de ${CUSTOMER_DOC_MAX} caracteres.`);
  if (email !== "" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new UserError("Ese correo no parece válido. Revísalo o déjalo vacío.");
  }
  const stamp = now.toISOString();
  const search = searchText(name, doc, phone);

  return transaction(db, () => {
    if (doc !== "") {
      const owner = db.prepare("SELECT id, name FROM customers WHERE doc = ? AND active = 1").get(doc) as
        | { id: string; name: string }
        | undefined;
      if (owner && owner.id !== id) throw new UserError(`Ya hay un cliente con el documento ${doc}: «${owner.name}».`);
    }
    let customerId: string;
    if (id === undefined) {
      customerId = randomUUID();
      db.prepare(
        `INSERT INTO customers (id, name, doc, phone, email, address, note, search, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(customerId, name, doc, phone, email, address, note, search, stamp, stamp);
    } else {
      customerId = id;
      const result = db
        .prepare("UPDATE customers SET name = ?, doc = ?, phone = ?, email = ?, address = ?, note = ?, search = ?, updated_at = ? WHERE id = ?")
        .run(name, doc, phone, email, address, note, search, stamp, id);
      if (result.changes === 0) throw new UserError("Ese cliente ya no existe.");
    }
    return getCustomer(db, customerId);
  });
}

/** Archiva un cliente o lo recupera. Nunca se borra: sus ventas lo necesitan. */
export function setCustomerActive(db: Db, idValue: unknown, activeValue: unknown, now = new Date()): Customer {
  const id = asString(idValue, "cliente");
  const active = asBoolean(activeValue);
  return transaction(db, () => {
    const customer = getCustomer(db, id);
    if (active && customer.doc !== "") {
      const owner = db.prepare("SELECT name FROM customers WHERE doc = ? AND active = 1 AND id <> ?").get(customer.doc, id) as
        | { name: string }
        | undefined;
      if (owner) throw new UserError(`No se puede recuperar: «${owner.name}» ya usa el documento ${customer.doc}.`);
    }
    db.prepare("UPDATE customers SET active = ?, updated_at = ? WHERE id = ?").run(active ? 1 : 0, now.toISOString(), id);
    return getCustomer(db, id);
  });
}
