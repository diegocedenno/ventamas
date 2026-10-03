import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import type { CurrencyCode } from "@shared/money";
import { normalize } from "@shared/text";
import { asArray, asBoolean, asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import {
  CATEGORY_MAX,
  CODE_MAX,
  describeVariant,
  LIST_LIMIT,
  MAX_VARIANTS,
  PRODUCT_NAME_MAX,
  VARIANT_TEXT_MAX,
  type Product,
  type ProductSummary,
  type SearchResult,
  type Variant,
} from "../api";

interface ProductRow {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number | null;
  currency: string;
  active: number;
}

interface VariantRow {
  id: string;
  product_id: string;
  size: string;
  color: string;
  code: string;
  active: number;
  key: string;
  stock: number;
}

const variantKey = (size: string, color: string): string => `${normalize(size)}|${normalize(color)}`;

const toVariant = (row: VariantRow): Variant => ({
  id: row.id,
  size: row.size,
  color: row.color,
  code: row.code,
  stock: row.stock,
  active: row.active === 1,
});

const toProduct = (row: ProductRow, variants: Variant[]): Product => ({
  id: row.id,
  name: row.name,
  category: row.category,
  price: row.price,
  cost: row.cost,
  currency: row.currency as CurrencyCode,
  active: row.active === 1,
  variants,
});

const PRODUCT_COLUMNS = "p.id, p.name, p.category, p.price, p.cost, p.currency, p.active";

// Las existencias de una pieza son la suma de sus movimientos.
const VARIANTS_WITH_STOCK = `
  SELECT v.id, v.product_id, v.size, v.color, v.code, v.active, v.key,
         COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.variant_id = v.id), 0) AS stock
  FROM variants v
`;

function activeVariantsOf(db: Db, productIds: readonly string[]): Map<string, Variant[]> {
  const byProduct = new Map<string, Variant[]>(productIds.map((id) => [id, []]));
  if (productIds.length === 0) return byProduct;
  const marks = productIds.map(() => "?").join(", ");
  const rows = db
    .prepare(`${VARIANTS_WITH_STOCK} WHERE v.product_id IN (${marks}) AND v.active = 1 ORDER BY v.position, v.rowid`)
    .all(...productIds) as unknown as VariantRow[];
  for (const row of rows) byProduct.get(row.product_id)?.push(toVariant(row));
  return byProduct;
}

/** Condición SQL para buscar por palabras, sin importar acentos ni mayúsculas. */
function searchFilter(query: string): { where: string; params: string[] } {
  const terms = normalize(query).split(" ").filter(Boolean).slice(0, 6);
  return {
    where: terms.map(() => "p.search LIKE ? ESCAPE '\\'").join(" AND "),
    params: terms.map((term) => `%${term.replace(/[\\%_]/g, "\\$&")}%`),
  };
}

export function listProducts(db: Db, queryValue: unknown = "", includeInactive: unknown = false): ProductSummary[] {
  const { where, params } = searchFilter(asString(queryValue, "búsqueda"));
  const conditions = [where, asBoolean(includeInactive) ? "" : "p.active = 1"].filter(Boolean);
  const rows = db
    .prepare(
      `
      SELECT p.id, p.name, p.category, p.price, p.currency, p.active,
             COUNT(s.id) AS variant_count,
             COALESCE(SUM(s.stock), 0) AS stock,
             COALESCE(MIN(s.stock), 0) AS lowest
      FROM products p
      LEFT JOIN (${VARIANTS_WITH_STOCK} WHERE v.active = 1) s ON s.product_id = p.id
      ${conditions.length ? "WHERE " + conditions.join(" AND ") : ""}
      GROUP BY p.id
      ORDER BY p.search
      LIMIT ?
      `
    )
    .all(...params, LIST_LIMIT) as unknown as Array<ProductRow & { variant_count: number; stock: number; lowest: number }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    category: row.category,
    price: row.price,
    currency: row.currency as CurrencyCode,
    active: row.active === 1,
    variantCount: row.variant_count,
    stock: row.stock,
    needsReview: row.lowest < 0,
  }));
}

export function getProduct(db: Db, idValue: unknown): Product {
  const id = asString(idValue, "producto");
  const row = db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.id = ?`).get(id) as ProductRow | undefined;
  if (!row) throw new UserError("Ese producto ya no existe.");
  return toProduct(row, activeVariantsOf(db, [id]).get(id) ?? []);
}

/** Lo que encuentra el buscador de la pantalla de venta: productos en venta con sus piezas. */
export function searchForSale(db: Db, queryValue: unknown, limit = 12): SearchResult {
  const query = asString(queryValue, "búsqueda").trim();
  if (query === "") return { products: [], exact: null };

  const byCode = db
    .prepare(
      `SELECT v.id, v.product_id FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.code = ? AND v.active = 1 AND p.active = 1`
    )
    .get(query) as { id: string; product_id: string } | undefined;

  const { where, params } = searchFilter(query);
  const rows = (
    where
      ? db
          .prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.active = 1 AND ${where} ORDER BY p.search LIMIT ?`)
          .all(...params, limit)
      : []
  ) as unknown as ProductRow[];

  // La pieza del código exacto va primero aunque su nombre no coincida con lo buscado.
  if (byCode && !rows.some((row) => row.id === byCode.product_id)) {
    rows.unshift(
      db.prepare(`SELECT ${PRODUCT_COLUMNS} FROM products p WHERE p.id = ?`).get(byCode.product_id) as unknown as ProductRow
    );
  }

  const variants = activeVariantsOf(
    db,
    rows.map((row) => row.id)
  );
  return {
    products: rows.map((row) => toProduct(row, variants.get(row.id) ?? [])),
    exact: byCode ? { productId: byCode.product_id, variantId: byCode.id } : null,
  };
}

interface CleanVariant {
  id: string | undefined;
  size: string;
  color: string;
  code: string;
  stock: number;
  key: string;
}

function cleanVariants(value: unknown): CleanVariant[] {
  const list = asArray(value, "tallas y colores");
  if (list.length === 0) throw new UserError("El producto necesita al menos una pieza para vender.");
  if (list.length > MAX_VARIANTS) {
    throw new UserError(`Un producto no puede tener más de ${MAX_VARIANTS} combinaciones de talla y color.`);
  }

  const keys = new Set<string>();
  const codes = new Set<string>();
  return list.map((item) => {
    const raw = asObject(item, "talla y color");
    const size = asText(raw.size, "la talla", VARIANT_TEXT_MAX);
    const color = asText(raw.color, "el color", VARIANT_TEXT_MAX);
    const code = asText(raw.code, "el código", CODE_MAX);
    const stock = asInteger(raw.stock, "existencias");
    const key = variantKey(size, color);
    const label = [size, color].filter(Boolean).join(" ") || "sin talla ni color";

    if (keys.has(key)) throw new UserError(`La combinación «${label}» está repetida.`);
    keys.add(key);
    if (code !== "") {
      if (codes.has(code)) throw new UserError(`El código «${code}» está repetido en este producto.`);
      codes.add(code);
    }
    if (Math.abs(stock) > 1_000_000) throw new UserError("Las existencias no pueden pasar de un millón de piezas.");
    return { id: raw.id === undefined ? undefined : asString(raw.id, "pieza"), size, color, code, stock, key };
  });
}

/**
 * Crea o actualiza un producto con sus tallas y colores. Las existencias se indican como
 * "cuántas debe haber": la diferencia con lo que hay se registra como un movimiento.
 * Una talla o color que ya no viene en la lista deja de venderse, pero no se borra.
 */
export function saveProduct(db: Db, value: unknown, currency: CurrencyCode, now = new Date()): Product {
  const input = asObject(value, "producto");
  const id = input.id === undefined ? undefined : asString(input.id, "producto");
  const name = asText(input.name, "el nombre del producto", PRODUCT_NAME_MAX, true);
  const category = asText(input.category, "la categoría", CATEGORY_MAX);
  const price = asInteger(input.price, "precio");
  const cost = input.cost === null ? null : asInteger(input.cost, "costo");
  if (price < 0) throw new UserError("El precio no puede ser negativo.");
  if (cost !== null && cost < 0) throw new UserError("El costo no puede ser negativo.");
  const variants = cleanVariants(input.variants);
  const stamp = now.toISOString();
  const search = normalize(`${name} ${category}`);

  return transaction(db, () => {
    let productId: string;
    if (id === undefined) {
      productId = randomUUID();
      db.prepare(
        `INSERT INTO products (id, name, category, price, cost, currency, search, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(productId, name, category, price, cost, currency, search, stamp, stamp);
    } else {
      productId = id;
      const result = db
        .prepare("UPDATE products SET name = ?, category = ?, price = ?, cost = ?, search = ?, updated_at = ? WHERE id = ?")
        .run(name, category, price, cost, search, stamp, id);
      if (result.changes === 0) throw new UserError("Ese producto ya no existe.");
    }

    const existing = db.prepare(`${VARIANTS_WITH_STOCK} WHERE v.product_id = ?`).all(productId) as unknown as VariantRow[];
    const byId = new Map(existing.map((row) => [row.id, row]));
    const byKey = new Map(existing.map((row) => [row.key, row]));

    // A cada pieza de la lista le corresponde una fila: la que ya tiene esa talla y color
    // (aunque estuviera retirada), o la que se está renombrando, o una nueva.
    const taken = new Set<string>();
    const rowFor = new Map<CleanVariant, VariantRow>();
    for (const variant of variants) {
      const row = byKey.get(variant.key);
      if (row) {
        rowFor.set(variant, row);
        taken.add(row.id);
      }
    }
    for (const variant of variants) {
      if (rowFor.has(variant) || variant.id === undefined) continue;
      const row = byId.get(variant.id);
      if (!row) throw new UserError("Una de las tallas ya no existe. Cierra el producto y vuelve a abrirlo.");
      if (!taken.has(row.id)) {
        rowFor.set(variant, row);
        taken.add(row.id);
      }
    }

    // Lo que ya no está en la lista deja de venderse, y los códigos se sueltan antes de
    // reasignarlos por si dos piezas los intercambian.
    const retire = db.prepare("UPDATE variants SET active = 0 WHERE id = ?");
    const release = db.prepare("UPDATE variants SET code = '' WHERE id = ?");
    for (const row of existing) {
      if (taken.has(row.id)) release.run(row.id);
      else retire.run(row.id);
    }

    const codeOwner = db.prepare(
      `SELECT p.name, p.active FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.code = ? AND v.active = 1 AND v.id <> ?`
    );
    const insert = db.prepare(
      "INSERT INTO variants (id, product_id, size, color, code, active, position, key) VALUES (?, ?, ?, ?, ?, 1, ?, ?)"
    );
    const update = db.prepare(
      "UPDATE variants SET size = ?, color = ?, code = ?, active = 1, position = ?, key = ? WHERE id = ?"
    );
    const move = db.prepare(
      "INSERT INTO stock_movements (id, variant_id, quantity, reason, created_at) VALUES (?, ?, ?, ?, ?)"
    );

    variants.forEach((variant, position) => {
      const row = rowFor.get(variant);
      const variantId = row?.id ?? randomUUID();
      if (variant.code !== "") {
        const owner = codeOwner.get(variant.code, variantId) as { name: string; active: number } | undefined;
        if (owner) {
          const retired = owner.active === 1 ? "" : " (retirado de la venta)";
          throw new UserError(`El código «${variant.code}» ya lo usa «${owner.name}»${retired}.`);
        }
      }
      if (row) update.run(variant.size, variant.color, variant.code, position, variant.key, variantId);
      else insert.run(variantId, productId, variant.size, variant.color, variant.code, position, variant.key);

      const difference = variant.stock - (row?.stock ?? 0);
      if (difference !== 0) move.run(randomUUID(), variantId, difference, row ? "ajuste" : "inicial", stamp);
    });

    return getProduct(db, productId);
  });
}

/** Retira un producto de la venta o lo devuelve. Nunca se borra: sus ventas lo necesitan. */
export function setProductActive(db: Db, idValue: unknown, activeValue: unknown, now = new Date()): void {
  const result = db
    .prepare("UPDATE products SET active = ?, updated_at = ? WHERE id = ?")
    .run(asBoolean(activeValue) ? 1 : 0, now.toISOString(), asString(idValue, "producto"));
  if (result.changes === 0) throw new UserError("Ese producto ya no existe.");
}

export interface SaleItem {
  variantId: string;
  description: string;
  unitPrice: number;
  currency: CurrencyCode;
}

/** Datos de una pieza en venta, tal como están ahora. Lanza UserError si ya no se vende. */
export function getSaleItem(db: Db, variantId: string): SaleItem {
  const row = db
    .prepare(
      `SELECT v.id, v.size, v.color, p.name, p.price, p.currency
       FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ? AND v.active = 1 AND p.active = 1`
    )
    .get(variantId) as { id: string; size: string; color: string; name: string; price: number; currency: string } | undefined;
  if (!row) throw new UserError("Uno de los productos ya no está en venta. Quítalo y vuelve a buscarlo.");
  return {
    variantId: row.id,
    description: describeVariant(row.name, row),
    unitPrice: row.price,
    currency: row.currency as CurrencyCode,
  };
}

/** Descuenta del inventario lo vendido. Se llama dentro de la transacción de la venta. */
export function recordSaleStock(
  db: Db,
  saleId: string,
  lines: ReadonlyArray<{ variantId: string; quantity: number }>,
  stamp: string
): void {
  const move = db.prepare(
    "INSERT INTO stock_movements (id, variant_id, quantity, reason, reference, created_at) VALUES (?, ?, ?, 'venta', ?, ?)"
  );
  for (const line of lines) move.run(randomUUID(), line.variantId, -line.quantity, saleId, stamp);
}
