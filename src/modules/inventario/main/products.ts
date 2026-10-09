import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import type { CurrencyCode } from "@shared/money";
import { normalize } from "@shared/text";
import { asArray, asBoolean, asInteger, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import {
  BROWSE_LIMIT,
  CATEGORY_MAX,
  CODE_MAX,
  describeVariant,
  LIST_LIMIT,
  MAX_STOCK,
  MAX_VARIANTS,
  OPTION_NAME_MAX,
  PRODUCT_NAME_MAX,
  VARIANT_TEXT_MAX,
  type Product,
  type ProductKind,
  type ProductSummary,
  type SearchResult,
  type Variant,
} from "../api";
import { ensureCategory } from "./categories";

interface ProductRow {
  id: string;
  name: string;
  kind: string;
  category_id: string | null;
  category: string;
  price: number;
  cost: number | null;
  currency: string;
  active: number;
  option1: string;
  option2: string;
  min_stock: number | null;
  open_price: number;
  tax_class: string;
}

interface VariantRow {
  id: string;
  product_id: string;
  value1: string;
  value2: string;
  code: string;
  active: number;
  key: string;
  price: number | null;
  cost: number | null;
  stock: number;
}

const variantKey = (value1: string, value2: string): string => `${normalize(value1)}|${normalize(value2)}`;

const toVariant = (row: VariantRow): Variant => ({
  id: row.id,
  value1: row.value1,
  value2: row.value2,
  code: row.code,
  stock: row.stock,
  active: row.active === 1,
  price: row.price,
  cost: row.cost,
});

const toProduct = (row: ProductRow, variants: Variant[]): Product => ({
  id: row.id,
  name: row.name,
  kind: row.kind as ProductKind,
  categoryId: row.category_id,
  category: row.category,
  price: row.price,
  cost: row.cost,
  currency: row.currency as CurrencyCode,
  active: row.active === 1,
  option1: row.option1,
  option2: row.option2,
  minStock: row.min_stock,
  openPrice: row.open_price === 1,
  taxClass: row.tax_class,
  variants,
});

const PRODUCTS = `
  SELECT p.id, p.name, p.kind, p.category_id, COALESCE(c.name, '') AS category, p.price, p.cost, p.currency,
         p.active, p.option1, p.option2, p.min_stock, p.open_price, p.tax_class
  FROM products p LEFT JOIN categories c ON c.id = p.category_id
`;

// Las existencias de una pieza son la suma de sus movimientos.
export const VARIANTS_WITH_STOCK = `
  SELECT v.id, v.product_id, v.value1, v.value2, v.code, v.active, v.key, v.price, v.cost,
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

function withVariants(db: Db, rows: readonly ProductRow[]): Product[] {
  const variants = activeVariantsOf(
    db,
    rows.map((row) => row.id)
  );
  return rows.map((row) => toProduct(row, variants.get(row.id) ?? []));
}

/** Condición SQL para buscar por palabras, sin importar acentos ni mayúsculas. */
function searchFilter(query: string): { where: string; params: string[] } {
  const terms = normalize(query).split(" ").filter(Boolean).slice(0, 6);
  return {
    where: terms.map(() => "p.search LIKE ? ESCAPE '\\'").join(" AND "),
    params: terms.map((term) => `%${term.replace(/[\\%_]/g, "\\$&")}%`),
  };
}

function asKind(value: unknown): ProductKind {
  if (value === undefined || value === "producto") return "producto";
  if (value === "servicio") return "servicio";
  throw new TypeError("Tipo de producto no válido.");
}

export function listProducts(db: Db, filterValue: unknown = {}): ProductSummary[] {
  const filter = asObject(filterValue, "filtro");
  const { where, params } = searchFilter(filter.query === undefined ? "" : asString(filter.query, "búsqueda"));
  const conditions = [where];
  const values: Array<string | number> = [...params];
  if (!(filter.includeInactive !== undefined && asBoolean(filter.includeInactive))) conditions.push("p.active = 1");
  if (filter.categoryId !== undefined && filter.categoryId !== null) {
    conditions.push("p.category_id = ?");
    values.push(asString(filter.categoryId, "categoría"));
  }
  if (filter.kind !== undefined && filter.kind !== null) {
    conditions.push("p.kind = ?");
    values.push(asKind(filter.kind));
  }
  const lowOnly = filter.lowOnly !== undefined && asBoolean(filter.lowOnly);
  const negativeOnly = filter.negativeOnly !== undefined && asBoolean(filter.negativeOnly);
  const having = [lowOnly ? "low > 0" : "", negativeOnly ? "lowest < 0" : ""].filter(Boolean);
  const filters = conditions.filter(Boolean);

  const rows = db
    .prepare(
      `
      SELECT p.id, p.name, p.kind, COALESCE(c.name, '') AS category, p.currency, p.active, p.open_price,
             COUNT(s.id) AS variant_count,
             COALESCE(SUM(s.stock), 0) AS stock,
             COALESCE(MIN(s.stock), 0) AS lowest,
             COALESCE(MIN(COALESCE(s.price, p.price)), p.price) AS price_min,
             COALESCE(MAX(COALESCE(s.price, p.price)), p.price) AS price_max,
             COALESCE(SUM(p.kind = 'producto' AND p.min_stock IS NOT NULL AND s.stock <= p.min_stock), 0) AS low
      FROM products p
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN (${VARIANTS_WITH_STOCK} WHERE v.active = 1) s ON s.product_id = p.id
      ${filters.length ? "WHERE " + filters.join(" AND ") : ""}
      GROUP BY p.id
      ${having.length ? "HAVING " + having.join(" AND ") : ""}
      ORDER BY p.search
      LIMIT ?
      `
    )
    .all(...values, LIST_LIMIT) as unknown as Array<{
    id: string;
    name: string;
    kind: string;
    category: string;
    currency: string;
    active: number;
    open_price: number;
    variant_count: number;
    stock: number;
    lowest: number;
    price_min: number;
    price_max: number;
    low: number;
  }>;

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind as ProductKind,
    category: row.category,
    price: row.price_min,
    priceMax: row.price_max,
    currency: row.currency as CurrencyCode,
    active: row.active === 1,
    openPrice: row.open_price === 1,
    variantCount: row.variant_count,
    stock: row.stock,
    needsReview: row.lowest < 0,
    low: row.low,
  }));
}

export function getProduct(db: Db, idValue: unknown): Product {
  const id = asString(idValue, "producto");
  const row = db.prepare(`${PRODUCTS} WHERE p.id = ?`).get(id) as ProductRow | undefined;
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
    where ? db.prepare(`${PRODUCTS} WHERE p.active = 1 AND ${where} ORDER BY p.search LIMIT ?`).all(...params, limit) : []
  ) as unknown as ProductRow[];

  // La pieza del código exacto va primero aunque su nombre no coincida con lo buscado.
  if (byCode && !rows.some((row) => row.id === byCode.product_id)) {
    rows.unshift(db.prepare(`${PRODUCTS} WHERE p.id = ?`).get(byCode.product_id) as unknown as ProductRow);
  }

  return {
    products: withVariants(db, rows),
    exact: byCode ? { productId: byCode.product_id, variantId: byCode.id } : null,
  };
}

/** Los productos en venta de una categoría (o de todas), para la cuadrícula de la pantalla de venta. */
export function browseForSale(db: Db, categoryValue: unknown = null, limit = BROWSE_LIMIT): Product[] {
  const categoryId = categoryValue === null || categoryValue === undefined ? null : asString(categoryValue, "categoría");
  const rows = (
    categoryId === null
      ? db.prepare(`${PRODUCTS} WHERE p.active = 1 ORDER BY p.search LIMIT ?`).all(limit)
      : db.prepare(`${PRODUCTS} WHERE p.active = 1 AND p.category_id = ? ORDER BY p.search LIMIT ?`).all(categoryId, limit)
  ) as unknown as ProductRow[];
  return withVariants(db, rows);
}

interface CleanVariant {
  id: string | undefined;
  value1: string;
  value2: string;
  code: string;
  stock: number;
  price: number | null;
  cost: number | null;
  key: string;
}

const optionalAmount = (value: unknown, what: string): number | null => {
  if (value === undefined || value === null) return null;
  const amount = asInteger(value, what);
  if (amount < 0) throw new UserError(`${what.charAt(0).toUpperCase()}${what.slice(1)} no puede ser negativo.`);
  return amount;
};

function cleanVariants(value: unknown): CleanVariant[] {
  const list = asArray(value, "variantes");
  if (list.length === 0) throw new UserError("El producto necesita al menos una pieza para vender.");
  if (list.length > MAX_VARIANTS) throw new UserError(`Un producto no puede tener más de ${MAX_VARIANTS} combinaciones.`);

  const keys = new Set<string>();
  const codes = new Set<string>();
  return list.map((item) => {
    const raw = asObject(item, "variante");
    const value1 = asText(raw.value1, "la variante", VARIANT_TEXT_MAX);
    const value2 = asText(raw.value2, "la variante", VARIANT_TEXT_MAX);
    const code = asText(raw.code, "el código", CODE_MAX);
    const stock = asInteger(raw.stock, "existencias");
    const key = variantKey(value1, value2);
    const label = [value1, value2].filter(Boolean).join(" ") || "sin variantes";

    if (keys.has(key)) throw new UserError(`La combinación «${label}» está repetida.`);
    keys.add(key);
    if (code !== "") {
      if (codes.has(code)) throw new UserError(`El código «${code}» está repetido en este producto.`);
      codes.add(code);
    }
    if (Math.abs(stock) > MAX_STOCK) throw new UserError("Las existencias no pueden pasar de un millón de piezas.");
    return {
      id: raw.id === undefined ? undefined : asString(raw.id, "pieza"),
      value1,
      value2,
      code,
      stock,
      price: optionalAmount(raw.price, "el precio"),
      cost: optionalAmount(raw.cost, "el costo"),
      key,
    };
  });
}

export interface SaveOptions {
  /** Moneda de los precios de la tienda. */
  currency: CurrencyCode;
  /** Dice si existe esa tasa de impuesto. Si falta, no se comprueba. */
  isTaxClass?: (id: string) => boolean;
}

/**
 * Crea o actualiza un producto con sus piezas. Las existencias se indican como "cuántas
 * debe haber": la diferencia con lo que hay se registra como un movimiento. Una pieza
 * que ya no viene en la lista deja de venderse, pero no se borra.
 */
export function saveProduct(db: Db, value: unknown, options: SaveOptions, now = new Date()): Product {
  const input = asObject(value, "producto");
  const id = input.id === undefined ? undefined : asString(input.id, "producto");
  const name = asText(input.name, "el nombre del producto", PRODUCT_NAME_MAX, true);
  const kind = asKind(input.kind);
  const category = asText(input.category ?? "", "la categoría", CATEGORY_MAX);
  const price = asInteger(input.price, "precio");
  const cost = optionalAmount(input.cost, "el costo");
  if (price < 0) throw new UserError("El precio no puede ser negativo.");
  const openPrice = input.openPrice !== undefined && asBoolean(input.openPrice);
  const taxClass = input.taxClass === undefined ? "general" : asString(input.taxClass, "impuesto");
  if (options.isTaxClass && !options.isTaxClass(taxClass)) throw new UserError("Ese impuesto ya no existe. Elige otro.");
  let minStock = input.minStock === undefined || input.minStock === null ? null : asInteger(input.minStock, "existencia mínima");
  if (minStock !== null && (minStock < 0 || minStock > MAX_STOCK)) throw new UserError("La existencia mínima no es válida.");

  const variants = cleanVariants(input.variants);
  let option1 = asText(input.option1 ?? "", "el nombre de la variante", OPTION_NAME_MAX);
  let option2 = asText(input.option2 ?? "", "el nombre de la variante", OPTION_NAME_MAX);
  const uses1 = variants.some((variant) => variant.value1 !== "");
  const uses2 = variants.some((variant) => variant.value2 !== "");

  // Un servicio puede tener modalidades (corte de dama o de caballero), pero no existencias.
  if (kind === "servicio") minStock = null;
  if (uses1 && option1 === "") throw new UserError("Ponle nombre a la primera variante: Talla, Capacidad, Presentación…");
  if (uses2 && option2 === "") throw new UserError("Ponle nombre a la segunda variante: Color, Sabor, Material…");
  if (uses1 && uses2 && normalize(option1) === normalize(option2)) {
    throw new UserError("Las dos variantes no pueden llamarse igual.");
  }
  if (!uses1) option1 = "";
  if (!uses2) option2 = "";

  const stamp = now.toISOString();
  const search = normalize(`${name} ${category}`);

  return transaction(db, () => {
    const categoryId = ensureCategory(db, category, { kind, option1, option2 });

    let productId: string;
    if (id === undefined) {
      productId = randomUUID();
      db.prepare(
        `INSERT INTO products
           (id, name, kind, category_id, price, cost, currency, option1, option2, min_stock, open_price, tax_class, search, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        productId,
        name,
        kind,
        categoryId,
        price,
        cost,
        options.currency,
        option1,
        option2,
        minStock,
        openPrice ? 1 : 0,
        taxClass,
        search,
        stamp,
        stamp
      );
    } else {
      productId = id;
      const current = db.prepare("SELECT kind FROM products WHERE id = ?").get(id) as { kind: string } | undefined;
      if (!current) throw new UserError("Ese producto ya no existe.");
      if (current.kind !== kind) {
        throw new UserError("Un producto no se convierte en servicio ni al revés. Retíralo de la venta y crea uno nuevo.");
      }
      db.prepare(
        `UPDATE products SET name = ?, category_id = ?, price = ?, cost = ?, option1 = ?, option2 = ?, min_stock = ?,
                open_price = ?, tax_class = ?, search = ?, updated_at = ?
         WHERE id = ?`
      ).run(name, categoryId, price, cost, option1, option2, minStock, openPrice ? 1 : 0, taxClass, search, stamp, id);
    }

    const existing = db.prepare(`${VARIANTS_WITH_STOCK} WHERE v.product_id = ?`).all(productId) as unknown as VariantRow[];
    const byId = new Map(existing.map((row) => [row.id, row]));
    const byKey = new Map(existing.map((row) => [row.key, row]));

    // A cada pieza de la lista le corresponde una fila: la que ya tiene esa combinación
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
      if (!row) throw new UserError("Una de las piezas ya no existe. Cierra el producto y vuelve a abrirlo.");
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
      `INSERT INTO variants (id, product_id, value1, value2, code, price, cost, active, position, key)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
    );
    const update = db.prepare(
      "UPDATE variants SET value1 = ?, value2 = ?, code = ?, price = ?, cost = ?, active = 1, position = ?, key = ? WHERE id = ?"
    );
    const move = db.prepare("INSERT INTO stock_movements (id, variant_id, quantity, reason, created_at) VALUES (?, ?, ?, ?, ?)");

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
      // Una pieza con el mismo precio o costo que el producto no guarda uno propio.
      const ownPrice = variant.price === null || variant.price === price ? null : variant.price;
      const ownCost = variant.cost === null || variant.cost === cost ? null : variant.cost;
      if (row) update.run(variant.value1, variant.value2, variant.code, ownPrice, ownCost, position, variant.key, variantId);
      else insert.run(variantId, productId, variant.value1, variant.value2, variant.code, ownPrice, ownCost, position, variant.key);

      // Un servicio no lleva existencias.
      if (kind === "servicio") return;
      const difference = variant.stock - (row?.stock ?? 0);
      if (difference !== 0) move.run(randomUUID(), variantId, difference, row ? "conteo" : "inicial", stamp);
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
  kind: ProductKind;
  unitPrice: number;
  /** Lo que cuesta la pieza hoy; null si no se registró. */
  unitCost: number | null;
  currency: CurrencyCode;
  /** El precio lo escribe quien vende. */
  openPrice: boolean;
  taxClass: string;
  /** Existencias de la pieza ahora mismo. */
  stock: number;
}

/** Datos de una pieza en venta, tal como están ahora; undefined si ya no se vende. */
export function findSaleItem(db: Db, variantId: string): SaleItem | undefined {
  const row = db
    .prepare(
      `SELECT v.id, v.value1, v.value2, p.name, p.kind, p.currency, p.open_price, p.tax_class,
              COALESCE(v.price, p.price) AS price, COALESCE(v.cost, p.cost) AS cost,
              COALESCE((SELECT SUM(m.quantity) FROM stock_movements m WHERE m.variant_id = v.id), 0) AS stock
       FROM variants v JOIN products p ON p.id = v.product_id
       WHERE v.id = ? AND v.active = 1 AND p.active = 1`
    )
    .get(variantId) as
    | {
        id: string;
        value1: string;
        value2: string;
        name: string;
        kind: string;
        currency: string;
        open_price: number;
        tax_class: string;
        price: number;
        cost: number | null;
        stock: number;
      }
    | undefined;
  if (!row) return undefined;
  return {
    variantId: row.id,
    description: describeVariant(row.name, row),
    kind: row.kind as ProductKind,
    unitPrice: row.price,
    unitCost: row.cost,
    currency: row.currency as CurrencyCode,
    openPrice: row.open_price === 1,
    taxClass: row.tax_class,
    stock: row.stock,
  };
}

/** Datos de una pieza en venta, tal como están ahora. Lanza UserError si ya no se vende. */
export function getSaleItem(db: Db, variantId: string): SaleItem {
  const item = findSaleItem(db, variantId);
  if (!item) throw new UserError("Uno de los productos ya no está en venta. Quítalo y vuelve a buscarlo.");
  return item;
}

/** Descuenta del inventario lo vendido. Los servicios no llevan existencias. Se llama dentro de la transacción de la venta. */
export function recordSaleStock(
  db: Db,
  saleId: string,
  lines: ReadonlyArray<{ variantId: string; quantity: number; kind?: ProductKind }>,
  stamp: string
): void {
  const move = db.prepare(
    "INSERT INTO stock_movements (id, variant_id, quantity, reason, reference, created_at) VALUES (?, ?, ?, 'venta', ?, ?)"
  );
  for (const line of lines) {
    if (line.kind === "servicio") continue;
    move.run(randomUUID(), line.variantId, -line.quantity, saleId, stamp);
  }
}
