// Candado de migraciones: una migración publicada nunca se edita ni se borra, porque ya
// corrió en las tiendas que la tienen instalada. Esta prueba compara cada migración con
// la huella guardada en migrations.lock.json.
//
// Al añadir una migración nueva, registra su huella con:
//   npm run lock-migrations
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { openDatabase } from "../main/db/database";
import { runMigrations } from "../main/db/migrate";
import { listCategories } from "./inventario/main/categories";
import { getProduct } from "./inventario/main/products";
import { readSettings, writeSetting } from "./nucleo/main/settings";
import { mainModules } from "./registry.main";
import { getSale } from "./ventas/main/sales";

const lockFile = join(__dirname, "migrations.lock.json");

// La huella ignora espacios y saltos de línea: reformatear el SQL no cambia lo que hace.
const fingerprint = (sql: string): string => createHash("sha256").update(sql.replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

const current: Record<string, string> = {};
for (const module of mainModules) {
  for (const migration of module.migrations) current[`${module.manifest.id}/${migration.id}`] = fingerprint(migration.sql);
}

if (process.env.VENTAMAS_LOCK_MIGRATIONS) {
  const locked: Record<string, string> = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};
  // Solo se añaden las nuevas: las ya registradas no se pisan.
  writeFileSync(lockFile, JSON.stringify({ ...current, ...locked }, null, 2) + "\n");
}

const locked: Record<string, string> = existsSync(lockFile) ? JSON.parse(readFileSync(lockFile, "utf8")) : {};

describe("migraciones publicadas", () => {
  it("ninguna migración registrada se ha editado ni borrado", () => {
    for (const [key, hash] of Object.entries(locked)) {
      expect(current[key], `La migración ${key} está publicada y no puede cambiar ni desaparecer: crea una nueva.`).toBe(hash);
    }
  });

  it("toda migración está registrada", () => {
    const missing = Object.keys(current).filter((key) => !(key in locked));
    expect(missing, "Migraciones nuevas sin registrar: ejecuta «npm run lock-migrations».").toEqual([]);
  });

  it("los identificadores son únicos y van en orden dentro de cada módulo", () => {
    for (const module of mainModules) {
      const ids = module.migrations.map((m) => m.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort()).toEqual(ids);
    }
  });
});

describe("actualizar desde una versión anterior", () => {
  it("una tienda de la versión 0.1 conserva sus ajustes al recibir los módulos nuevos", () => {
    const db = openDatabase(":memory:");
    const nucleo = mainModules.filter((m) => m.manifest.id === "nucleo");
    const asList = (modules: typeof mainModules) => modules.map((m) => ({ module: m.manifest.id, migrations: m.migrations }));

    // La versión 0.1 solo tenía el núcleo.
    runMigrations(db, asList(nucleo));
    writeSetting(db, "store.name", "Calzados Altamira");
    writeSetting(db, "ui.theme", "vino");

    let backups = 0;
    const applied = runMigrations(db, asList(mainModules), { backup: () => backups++ });

    expect(backups).toBe(1);
    expect(applied.length).toBeGreaterThan(0);
    expect(applied.every((key) => !key.startsWith("nucleo/"))).toBe(true);
    expect(readSettings(db)).toMatchObject({ "store.name": "Calzados Altamira", "ui.theme": "vino", "store.currency": "USD" });
    expect(db.prepare("SELECT COUNT(*) AS n FROM payment_methods").get()).toEqual({ n: 7 });
    db.close();
  });

  it("una tienda de la versión 0.2 conserva productos, existencias y ventas al pasar a la 0.3", () => {
    const db = openDatabase(":memory:");
    const asList = (modules: typeof mainModules) => modules.map((m) => ({ module: m.manifest.id, migrations: m.migrations }));

    // La 0.2 tenía cinco módulos, cada uno con su primera migración.
    const v02 = ["nucleo", "monedas", "inventario", "caja", "ventas"];
    runMigrations(
      db,
      mainModules.filter((m) => v02.includes(m.manifest.id)).map((m) => ({ module: m.manifest.id, migrations: m.migrations.slice(0, 1) }))
    );

    // Datos escritos como los guardaba la 0.2: categoría como texto, tallas y colores, y una venta.
    const at = "2026-10-05T14:00:00.000Z";
    db.exec(`
      INSERT INTO products (id, name, category, price, cost, currency, search, created_at, updated_at) VALUES
        ('p1', 'Zapato deportivo', 'Calzado', 4500, 2800, 'USD', 'zapato deportivo calzado', '${at}', '${at}'),
        ('p2', 'Sandalia', 'calzado', 2000, NULL, 'USD', 'sandalia calzado', '${at}', '${at}'),
        ('p3', 'Blusa', 'Ropa de dama', 2000, NULL, 'USD', 'blusa ropa de dama', '${at}', '${at}'),
        ('p4', 'Medias', '', 300, NULL, 'USD', 'medias', '${at}', '${at}');
      INSERT INTO variants (id, product_id, size, color, code, position, key) VALUES
        ('v1', 'p1', '38', 'Negro', '7591234000018', 0, '38|negro'),
        ('v2', 'p2', '36', '', '', 0, '36|'),
        ('v3', 'p3', 'M', '', '', 0, 'm|'),
        ('v4', 'p4', '', '', '', 0, '|');
      INSERT INTO stock_movements (id, variant_id, quantity, reason, reference, created_at) VALUES
        ('m1', 'v1', 3, 'inicial', NULL, '${at}'),
        ('m2', 'v1', -1, 'venta', 's1', '${at}'),
        ('m3', 'v1', 2, 'ajuste', NULL, '${at}'),
        ('m4', 'v4', 10, 'inicial', NULL, '${at}');
      INSERT INTO cash_sessions (id, opened_at) VALUES ('c1', '${at}');
      INSERT INTO sales (id, prefix, seq, session_id, currency, total, rates, created_at) VALUES
        ('s1', 'C01', 1, 'c1', 'USD', 4500, '{"pivot":"VES","rates":{"USD":866560000}}', '${at}');
      INSERT INTO sale_lines (id, sale_id, variant_id, description, quantity, unit_price, total, position) VALUES
        ('l1', 's1', 'v1', 'Zapato deportivo · 38 · Negro', 1, 4500, 4500, 0);
      INSERT INTO money_movements (id, session_id, method_id, kind, amount, currency, rate, sale_id, base_amount, base_currency, created_at) VALUES
        ('y1', 'c1', 'efectivo-usd', 'cobro', 4500, 'USD', 866560000, 's1', 4500, 'USD', '${at}');
    `);
    writeSetting(db, "store.name", "Calzados Altamira");

    let backups = 0;
    runMigrations(db, asList(mainModules), { backup: () => backups++ });
    expect(backups).toBe(1);

    // Las categorías escritas a mano pasan a la lista, sin duplicar "Calzado" y "calzado".
    const categories = listCategories(db);
    expect(categories.map((c) => [c.name, c.option1, c.option2, c.productCount])).toEqual([
      ["Calzado", "Talla", "Color", 2],
      ["Ropa de dama", "Talla", "", 1],
    ]);

    // Las tallas y colores pasan a ser variantes con nombre, con sus existencias.
    const shoe = getProduct(db, "p1");
    expect(shoe).toMatchObject({ kind: "producto", category: "Calzado", option1: "Talla", option2: "Color", minStock: null, openPrice: false });
    expect(shoe.variants).toMatchObject([{ id: "v1", value1: "38", value2: "Negro", code: "7591234000018", stock: 4, price: null }]);
    expect(getProduct(db, "p2")).toMatchObject({ category: "Calzado", option1: "Talla", option2: "" });
    expect(getProduct(db, "p4")).toMatchObject({ category: "", categoryId: null, option1: "", option2: "" });
    expect(getProduct(db, "p4").variants[0]?.stock).toBe(10);

    // Los movimientos conservan su orden y siguen siendo hechos.
    expect(db.prepare("SELECT id, reason, note FROM stock_movements ORDER BY rowid").all()).toEqual([
      { id: "m1", reason: "inicial", note: "" },
      { id: "m2", reason: "venta", note: "" },
      { id: "m3", reason: "ajuste", note: "" },
      { id: "m4", reason: "inicial", note: "" },
    ]);
    expect(() => db.exec("DELETE FROM stock_movements")).toThrow(/no se borran/);

    // La venta se lee igual: sin cliente, sin descuento y sin desglose de impuestos.
    expect(getSale(db, "s1")).toMatchObject({
      number: "C01-000001",
      total: 4500,
      subtotal: 4500,
      discount: 0,
      tax: 0,
      taxes: [],
      customer: null,
      lines: [{ description: "Zapato deportivo · 38 · Negro", kind: "producto", quantity: 1, unitPrice: 4500, total: 4500, discount: 0, taxCode: "" }],
      payments: [{ methodName: "Dólares efectivo", amount: 4500 }],
    });

    // La tienda ya estaba en marcha: no ve el asistente de bienvenida.
    expect(readSettings(db)).toMatchObject({ "store.name": "Calzados Altamira", "setup.done": true, "tax.enabled": false });
    db.close();
  });
});
