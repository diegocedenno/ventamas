import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { normalize, tidy } from "@shared/text";
import { asArray, asBoolean, asObject, asString, asText } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import {
  CATEGORY_MAX,
  MAX_SUGGESTED_VALUES,
  OPTION_NAME_MAX,
  VARIANT_TEXT_MAX,
  type Category,
  type ProductKind,
  type RubroInfo,
} from "../api";
import { RUBROS, templateOf } from "./catalog";

interface CategoryRow {
  id: string;
  name: string;
  kind: string;
  option1: string;
  values1: string;
  option2: string;
  values2: string;
  rubro: string;
  active: number;
  product_count: number;
}

function parseValues(json: string): string[] {
  try {
    const list: unknown = JSON.parse(json);
    return Array.isArray(list) ? list.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

const toCategory = (row: CategoryRow): Category => ({
  id: row.id,
  name: row.name,
  kind: row.kind as ProductKind,
  option1: row.option1,
  values1: parseValues(row.values1),
  option2: row.option2,
  values2: parseValues(row.values2),
  rubro: row.rubro,
  active: row.active === 1,
  productCount: row.product_count,
});

const CATEGORIES = `
  SELECT c.id, c.name, c.kind, c.option1, c.values1, c.option2, c.values2, c.rubro, c.active,
         (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.active = 1) AS product_count
  FROM categories c
`;

/** Las categorías de la tienda, por nombre. Las ocultas solo salen si se piden. */
export function listCategories(db: Db, includeInactive: unknown = false): Category[] {
  const all = includeInactive !== undefined && asBoolean(includeInactive);
  const rows = db.prepare(`${CATEGORIES} ${all ? "" : "WHERE c.active = 1"} ORDER BY c.key`).all() as unknown as CategoryRow[];
  return rows.map(toCategory);
}

/** Valores habituales de una variante: limpios, sin repetir y sin pasarse de largo. */
function cleanValues(value: unknown): string[] {
  const seen = new Set<string>();
  const values: string[] = [];
  for (const item of asArray(value, "valores")) {
    const text = tidy(asString(item, "valor"));
    const key = normalize(text);
    if (text === "" || seen.has(key)) continue;
    if (text.length > VARIANT_TEXT_MAX) throw new UserError(`«${text}» es demasiado largo: máximo ${VARIANT_TEXT_MAX} caracteres.`);
    seen.add(key);
    values.push(text);
  }
  if (values.length > MAX_SUGGESTED_VALUES) throw new UserError(`Una variante admite hasta ${MAX_SUGGESTED_VALUES} valores habituales.`);
  return values;
}

const nextPosition = (db: Db): number =>
  (db.prepare("SELECT COALESCE(MAX(position), 0) + 1 AS position FROM categories").get() as { position: number }).position;

/** Crea una categoría o cambia una que ya existe: su nombre y su plantilla de variantes. */
export function saveCategory(db: Db, value: unknown): Category[] {
  const input = asObject(value, "categoría");
  const id = input.id === undefined ? undefined : asString(input.id, "categoría");
  const name = asText(input.name, "el nombre de la categoría", CATEGORY_MAX, true);
  const kind: ProductKind = input.kind === "servicio" ? "servicio" : "producto";
  let option1 = asText(input.option1 ?? "", "el nombre de la variante", OPTION_NAME_MAX);
  let option2 = asText(input.option2 ?? "", "el nombre de la variante", OPTION_NAME_MAX);
  let values1 = cleanValues(input.values1 ?? []);
  let values2 = cleanValues(input.values2 ?? []);
  const active = input.active === undefined || asBoolean(input.active);

  if (option1 === "" && values1.length > 0) throw new UserError("Ponle nombre a la primera variante: Talla, Capacidad, Presentación…");
  if (option2 === "" && values2.length > 0) throw new UserError("Ponle nombre a la segunda variante: Color, Sabor, Material…");
  // Sin primera variante, la segunda pasa a ser la primera.
  if (option1 === "" && option2 !== "") {
    [option1, values1, option2, values2] = [option2, values2, "", []];
  }
  if (option1 !== "" && normalize(option1) === normalize(option2)) throw new UserError("Las dos variantes no pueden llamarse igual.");

  const key = normalize(name);
  return transaction(db, () => {
    const clash = db.prepare("SELECT id, name FROM categories WHERE key = ?").get(key) as { id: string; name: string } | undefined;
    if (clash && clash.id !== id) throw new UserError(`Ya hay una categoría llamada «${clash.name}».`);

    if (id === undefined) {
      db.prepare(
        `INSERT INTO categories (id, name, key, kind, option1, values1, option2, values2, active, position)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(randomUUID(), name, key, kind, option1, JSON.stringify(values1), option2, JSON.stringify(values2), active ? 1 : 0, nextPosition(db));
    } else {
      const result = db
        .prepare(
          "UPDATE categories SET name = ?, key = ?, kind = ?, option1 = ?, values1 = ?, option2 = ?, values2 = ?, active = ? WHERE id = ?"
        )
        .run(name, key, kind, option1, JSON.stringify(values1), option2, JSON.stringify(values2), active ? 1 : 0, id);
      if (result.changes === 0) throw new UserError("Esa categoría ya no existe.");
      // El buscador de productos incluye el nombre de la categoría.
      db.prepare("UPDATE products SET search = vm_normalize(name || ' ' || ?) WHERE category_id = ?").run(name, id);
    }
    return listCategories(db, true);
  });
}

/**
 * El identificador de la categoría con ese nombre; si no existe, la crea con las variantes
 * del producto que la estrena. Devuelve null si el nombre viene vacío. Si estaba oculta,
 * vuelve a mostrarse: alguien la está usando.
 */
export function ensureCategory(
  db: Db,
  name: string,
  defaults: { kind: ProductKind; option1: string; option2: string }
): string | null {
  if (name === "") return null;
  const key = normalize(name);
  const found = db.prepare("SELECT id, active FROM categories WHERE key = ?").get(key) as { id: string; active: number } | undefined;
  if (found) {
    if (found.active === 0) db.prepare("UPDATE categories SET active = 1 WHERE id = ?").run(found.id);
    return found.id;
  }
  const id = randomUUID();
  db.prepare("INSERT INTO categories (id, name, key, kind, option1, option2, position) VALUES (?, ?, ?, ?, ?, ?, ?)").run(
    id,
    name,
    key,
    defaults.kind,
    defaults.option1,
    defaults.option2,
    nextPosition(db)
  );
  return id;
}

/* ---------- catálogo por rubro ---------- */

/** Los tipos de comercio del catálogo incluido, y cuáles cargó ya la tienda. */
export function listRubros(db: Db): RubroInfo[] {
  const loaded = new Set((db.prepare("SELECT id FROM loaded_rubros").all() as Array<{ id: string }>).map((row) => row.id));
  return RUBROS.map((rubro) => ({
    id: rubro.id,
    name: rubro.name,
    description: rubro.description,
    sample: rubro.categories.slice(0, 4).map((category) => category.name),
    categoryCount: rubro.categories.length,
    loaded: loaded.has(rubro.id),
  }));
}

/**
 * Carga las categorías de un rubro. Las que la tienda ya tiene se respetan: solo reciben
 * la plantilla de variantes si no tenían ninguna. Se puede repetir sin duplicar nada.
 */
export function loadRubro(db: Db, idValue: unknown, now = new Date()): { added: number; categories: Category[] } {
  const rubro = RUBROS.find((item) => item.id === asString(idValue, "rubro"));
  if (!rubro) throw new UserError("Ese tipo de comercio no está en el catálogo.");

  return transaction(db, () => {
    db.prepare("INSERT INTO loaded_rubros (id, loaded_at) VALUES (?, ?) ON CONFLICT (id) DO NOTHING").run(rubro.id, now.toISOString());
    const find = db.prepare("SELECT id, option1, option2, rubro FROM categories WHERE key = ?");
    const insert = db.prepare(
      `INSERT INTO categories (id, name, key, kind, option1, values1, option2, values2, rubro, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const fill = db.prepare("UPDATE categories SET option1 = ?, values1 = ?, option2 = ?, values2 = ? WHERE id = ?");
    const tag = db.prepare("UPDATE categories SET rubro = ? WHERE id = ? AND rubro = ''");
    let position = nextPosition(db);
    let added = 0;

    for (const category of rubro.categories) {
      const template = templateOf(category);
      const key = normalize(category.name);
      const existing = find.get(key) as { id: string; option1: string; option2: string; rubro: string } | undefined;
      if (!existing) {
        insert.run(
          randomUUID(),
          category.name,
          key,
          category.kind ?? "producto",
          template.option1,
          JSON.stringify(template.values1),
          template.option2,
          JSON.stringify(template.values2),
          rubro.id,
          position++
        );
        added++;
        continue;
      }
      if (existing.option1 === "" && existing.option2 === "") {
        fill.run(template.option1, JSON.stringify(template.values1), template.option2, JSON.stringify(template.values2), existing.id);
      }
      tag.run(rubro.id, existing.id);
    }
    return { added, categories: listCategories(db, true) };
  });
}
