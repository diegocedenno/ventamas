import { immutable } from "../../../main/db/facts";
import type { Migration } from "../../../main/db/migrate";

export const migrations: readonly Migration[] = [
  {
    id: "0001_productos",
    sql: `
      CREATE TABLE products (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        category TEXT NOT NULL DEFAULT '',
        price INTEGER NOT NULL CHECK (price >= 0),
        cost INTEGER CHECK (cost IS NULL OR cost >= 0),
        currency TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        -- Nombre y categoría en minúsculas y sin acentos, para buscar.
        search TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      ) STRICT;

      -- Una pieza vendible: el producto en una talla y un color. Un producto sin tallas
      -- ni colores tiene una sola, con ambos vacíos.
      CREATE TABLE variants (
        id TEXT PRIMARY KEY,
        product_id TEXT NOT NULL REFERENCES products (id),
        size TEXT NOT NULL DEFAULT '',
        color TEXT NOT NULL DEFAULT '',
        code TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0,
        -- Talla y color normalizados: "negro" y "Negro" son la misma pieza.
        key TEXT NOT NULL,
        UNIQUE (product_id, key)
      ) STRICT;
      CREATE UNIQUE INDEX variants_code ON variants (code) WHERE code <> '' AND active = 1;

      -- Las existencias no son un campo: son la suma de estos movimientos.
      CREATE TABLE stock_movements (
        id TEXT PRIMARY KEY,
        variant_id TEXT NOT NULL REFERENCES variants (id),
        quantity INTEGER NOT NULL CHECK (quantity <> 0),
        reason TEXT NOT NULL CHECK (reason IN ('inicial', 'ajuste', 'venta')),
        -- Hecho que lo originó (la venta), si lo hay.
        reference TEXT,
        created_at TEXT NOT NULL
      ) STRICT;
      CREATE INDEX stock_movements_variant ON stock_movements (variant_id);
      ${immutable("stock_movements", "Los movimientos de inventario")}
    `,
  },
  {
    // Variantes con nombre propio (ya no solo talla y color), categorías con su plantilla
    // de variantes, servicios, precio por pieza, existencia mínima y más motivos de movimiento.
    id: "0002_catalogo",
    sql: `
      CREATE TABLE categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        -- Nombre en minúsculas y sin acentos: "Calzado" y "calzado" son la misma.
        key TEXT NOT NULL UNIQUE,
        kind TEXT NOT NULL DEFAULT 'producto' CHECK (kind IN ('producto', 'servicio')),
        -- Plantilla de variantes: el nombre de cada eje y sus valores habituales (JSON).
        option1 TEXT NOT NULL DEFAULT '',
        values1 TEXT NOT NULL DEFAULT '[]',
        option2 TEXT NOT NULL DEFAULT '',
        values2 TEXT NOT NULL DEFAULT '[]',
        -- Rubro del catálogo incluido del que vino; vacío si la creó la tienda.
        rubro TEXT NOT NULL DEFAULT '',
        active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
        position INTEGER NOT NULL DEFAULT 0
      ) STRICT;

      -- Los rubros del catálogo incluido cuyas categorías ya cargó la tienda.
      CREATE TABLE loaded_rubros (
        id TEXT PRIMARY KEY,
        loaded_at TEXT NOT NULL
      ) STRICT, WITHOUT ROWID;

      -- Las categorías que la tienda ya había escrito a mano pasan a la lista.
      INSERT INTO categories (id, name, key)
        SELECT vm_id(), MIN(category), vm_normalize(category) FROM products
        WHERE vm_normalize(category) <> '' GROUP BY vm_normalize(category);

      ALTER TABLE products ADD COLUMN category_id TEXT REFERENCES categories (id);
      UPDATE products SET category_id = (SELECT c.id FROM categories c WHERE c.key = vm_normalize(products.category));
      ALTER TABLE products DROP COLUMN category;
      CREATE INDEX products_category ON products (category_id);

      ALTER TABLE products ADD COLUMN kind TEXT NOT NULL DEFAULT 'producto' CHECK (kind IN ('producto', 'servicio'));
      ALTER TABLE products ADD COLUMN option1 TEXT NOT NULL DEFAULT '';
      ALTER TABLE products ADD COLUMN option2 TEXT NOT NULL DEFAULT '';
      -- Avisar cuando de una pieza queden estas o menos; NULL para no avisar.
      ALTER TABLE products ADD COLUMN min_stock INTEGER CHECK (min_stock IS NULL OR min_stock >= 0);
      -- El precio se escribe al vender.
      ALTER TABLE products ADD COLUMN open_price INTEGER NOT NULL DEFAULT 0 CHECK (open_price IN (0, 1));
      ALTER TABLE products ADD COLUMN tax_class TEXT NOT NULL DEFAULT 'general';

      -- Los dos ejes de variantes dejan de llamarse talla y color: cada producto les pone nombre.
      ALTER TABLE variants RENAME COLUMN size TO value1;
      ALTER TABLE variants RENAME COLUMN color TO value2;
      -- Precio y costo propios de la pieza; NULL si usa los del producto.
      ALTER TABLE variants ADD COLUMN price INTEGER CHECK (price IS NULL OR price >= 0);
      ALTER TABLE variants ADD COLUMN cost INTEGER CHECK (cost IS NULL OR cost >= 0);

      UPDATE products SET option1 = 'Talla'
        WHERE EXISTS (SELECT 1 FROM variants v WHERE v.product_id = products.id AND v.value1 <> '');
      UPDATE products SET option2 = 'Color'
        WHERE EXISTS (SELECT 1 FROM variants v WHERE v.product_id = products.id AND v.value2 <> '');
      UPDATE categories SET option1 = 'Talla'
        WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = categories.id AND p.option1 <> '');
      UPDATE categories SET option2 = 'Color'
        WHERE EXISTS (SELECT 1 FROM products p WHERE p.category_id = categories.id AND p.option2 <> '');

      -- Los movimientos ganan motivos, una nota y el costo de la entrada. Como la lista de
      -- motivos es una restricción de la tabla, se pasa todo a una tabla nueva.
      CREATE TABLE stock_movements_new (
        id TEXT PRIMARY KEY,
        variant_id TEXT NOT NULL REFERENCES variants (id),
        quantity INTEGER NOT NULL CHECK (quantity <> 0),
        reason TEXT NOT NULL CHECK (reason IN
          ('inicial', 'entrada', 'conteo', 'dano', 'perdida', 'uso', 'ajuste', 'venta', 'devolucion', 'anulacion')),
        -- Hecho que lo originó (la venta), si lo hay.
        reference TEXT,
        note TEXT NOT NULL DEFAULT '',
        -- En una entrada, lo que costó cada pieza.
        unit_cost INTEGER CHECK (unit_cost IS NULL OR unit_cost >= 0),
        created_at TEXT NOT NULL
      ) STRICT;
      INSERT INTO stock_movements_new (id, variant_id, quantity, reason, reference, created_at)
        SELECT id, variant_id, quantity, reason, reference, created_at FROM stock_movements ORDER BY rowid;
      DROP TABLE stock_movements;
      ALTER TABLE stock_movements_new RENAME TO stock_movements;
      CREATE INDEX stock_movements_variant ON stock_movements (variant_id);
      ${immutable("stock_movements", "Los movimientos de inventario")}
    `,
  },
];
