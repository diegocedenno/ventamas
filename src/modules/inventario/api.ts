import type { CurrencyCode } from "@shared/money";

export const INVENTARIO = {
  list: "inventario:list",
  get: "inventario:get",
  save: "inventario:save",
  setActive: "inventario:set-active",
  search: "inventario:search",
  browse: "inventario:browse",
  summary: "inventario:summary",
  suggestCode: "inventario:suggest-code",
  categories: "inventario:categories",
  saveCategory: "inventario:save-category",
  rubros: "inventario:rubros",
  loadRubro: "inventario:load-rubro",
  move: "inventario:move",
  movements: "inventario:movements",
} as const;

export const PRODUCT_NAME_MAX = 80;
export const CATEGORY_MAX = 40;
export const OPTION_NAME_MAX = 20;
export const VARIANT_TEXT_MAX = 20;
export const CODE_MAX = 40;
export const MAX_VARIANTS = 200;
export const MAX_SUGGESTED_VALUES = 60;
export const STOCK_NOTE_MAX = 120;
export const MAX_STOCK = 1_000_000;
/** La lista de productos muestra como máximo esta cantidad; con más, hay que buscar. */
export const LIST_LIMIT = 300;
/** Productos que caben en la cuadrícula de la pantalla de venta. */
export const BROWSE_LIMIT = 60;

/** Un producto lleva existencias; un servicio (un corte de pelo, una reparación) no. */
export type ProductKind = "producto" | "servicio";

/** Una pieza concreta que se vende: el producto en una combinación de sus variantes. */
export interface Variant {
  id: string;
  /** Valor del primer eje (la talla, la capacidad…); vacío si el producto no lo usa. */
  value1: string;
  /** Valor del segundo eje (el color, el sabor…); vacío si el producto no lo usa. */
  value2: string;
  /** Código de barras o código propio; vacío si no tiene. */
  code: string;
  /** Existencias: la suma de sus movimientos. Negativo si se vendió sin tener. Siempre 0 en un servicio. */
  stock: number;
  active: boolean;
  /** Precio propio de esta pieza; null si usa el del producto. */
  price: number | null;
  /** Costo propio de esta pieza; null si usa el del producto. */
  cost: number | null;
}

export interface Product {
  id: string;
  name: string;
  kind: ProductKind;
  categoryId: string | null;
  /** Nombre de la categoría; vacío si no tiene. */
  category: string;
  /** Precio final en unidad mínima de `currency`. */
  price: number;
  /** Costo de compra; null si no se registró. */
  cost: number | null;
  currency: CurrencyCode;
  active: boolean;
  /** Nombre del primer eje de variantes ("Talla"); vacío si no lo usa. */
  option1: string;
  /** Nombre del segundo eje ("Color"); vacío si no lo usa. */
  option2: string;
  /** Avisar cuando de una pieza queden estas o menos; null para no avisar. */
  minStock: number | null;
  /** El precio se escribe al vender (un arreglo, un servicio a medida). */
  openPrice: boolean;
  /** Tasa de impuesto que lleva. Solo cuenta si la tienda cobra impuestos. */
  taxClass: string;
  variants: Variant[];
}

/** El precio al que se vende una pieza: el suyo o, si no tiene, el del producto. */
export function priceOf(product: Pick<Product, "price">, variant: Pick<Variant, "price">): number {
  return variant.price ?? product.price;
}

/** El precio más bajo y el más alto entre las piezas de un producto. */
export function priceRange(product: Pick<Product, "price" | "variants">): { min: number; max: number } {
  const prices = product.variants.length ? product.variants.map((variant) => priceOf(product, variant)) : [product.price];
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

/** Fila de la lista de productos. */
export interface ProductSummary {
  id: string;
  name: string;
  kind: ProductKind;
  category: string;
  /** El precio más bajo entre sus piezas. */
  price: number;
  /** El más alto; igual a `price` si todas valen lo mismo. */
  priceMax: number;
  currency: CurrencyCode;
  active: boolean;
  openPrice: boolean;
  /** Piezas en venta. */
  variantCount: number;
  stock: number;
  /** Alguna pieza quedó en negativo: hay que contar y corregir. */
  needsReview: boolean;
  /** Piezas en el mínimo o por debajo. */
  low: number;
}

export interface ProductFilter {
  query: string;
  includeInactive: boolean;
  /** Solo los de esta categoría. */
  categoryId?: string | null;
  kind?: ProductKind | null;
  /** Solo los que tienen piezas en el mínimo o por debajo. */
  lowOnly?: boolean;
  /** Solo los que tienen alguna pieza en negativo. */
  negativeOnly?: boolean;
}

export interface VariantInput {
  /** Presente al editar una pieza que ya existía. */
  id?: string;
  value1: string;
  value2: string;
  code: string;
  /** Existencias que debe haber después de guardar. */
  stock: number;
  price: number | null;
  cost: number | null;
}

export interface ProductInput {
  /** Presente al editar. */
  id?: string;
  name: string;
  kind: ProductKind;
  /** Nombre de la categoría; si no existe, se crea. */
  category: string;
  price: number;
  cost: number | null;
  option1: string;
  option2: string;
  minStock: number | null;
  openPrice: boolean;
  taxClass: string;
  /** Las piezas en venta. Lo que no venga en la lista deja de venderse. */
  variants: VariantInput[];
}

export interface SearchResult {
  products: Product[];
  /** Si lo buscado es exactamente el código de una pieza, es esta. */
  exact: { productId: string; variantId: string } | null;
}

/** Una categoría con su plantilla de variantes: los ejes que usan sus productos y sus valores habituales. */
export interface Category {
  id: string;
  name: string;
  kind: ProductKind;
  option1: string;
  values1: string[];
  option2: string;
  values2: string[];
  /** Rubro del catálogo del que vino; vacío si la creó la tienda. */
  rubro: string;
  active: boolean;
  /** Productos en venta que la usan. */
  productCount: number;
}

export interface CategoryInput {
  id?: string;
  name: string;
  kind: ProductKind;
  option1: string;
  values1: string[];
  option2: string;
  values2: string[];
  active: boolean;
}

/** Un tipo de comercio del catálogo incluido, con sus categorías ya hechas. */
export interface RubroInfo {
  id: string;
  name: string;
  description: string;
  /** Algunos nombres de sus categorías, como muestra. */
  sample: string[];
  categoryCount: number;
  /** La tienda ya cargó sus categorías. */
  loaded: boolean;
}

/** Motivos con los que una persona mueve existencias a mano. */
export const STOCK_REASONS = ["entrada", "conteo", "dano", "perdida", "uso"] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export interface StockMoveInput {
  variantId: string;
  reason: StockReason;
  /**
   * Entrada: piezas que llegan. Conteo: piezas que hay en total. Daño, pérdida y uso
   * propio: piezas que salen. Siempre positivo (el conteo admite cero).
   */
  quantity: number;
  note: string;
  /** Solo en una entrada: lo que costó cada pieza. */
  unitCost?: number | null;
}

export interface StockMovement {
  id: string;
  /** "38 · Negro"; vacío si el producto tiene una sola pieza. */
  variant: string;
  /** Con signo: lo que sale es negativo. */
  quantity: number;
  reason: string;
  note: string;
  /** Lo que había de esa pieza después del movimiento. */
  balance: number;
  createdAt: string;
}

export interface InventorySummary {
  products: number;
  services: number;
  /** Piezas en existencia, sin contar las que están en negativo. */
  pieces: number;
  /** Productos con alguna pieza en el mínimo o por debajo. */
  low: number;
  /** Productos con alguna pieza en negativo. */
  negative: number;
  /** Lo que vale la mercancía a precio de venta. */
  saleValue: number;
  /** Lo que costó, contando solo los productos con costo registrado. */
  costValue: number;
  /** Productos en existencia sin costo registrado: no entran en `costValue`. */
  withoutCost: number;
  currency: CurrencyCode;
}

/** "Zapato deportivo · 38 · Negro" */
export function describeVariant(productName: string, variant: Pick<Variant, "value1" | "value2">): string {
  return [productName, variant.value1, variant.value2].filter(Boolean).join(" · ");
}

/** "38 · Negro"; vacío si la pieza es la única del producto. */
export function variantLabel(variant: Pick<Variant, "value1" | "value2">): string {
  return [variant.value1, variant.value2].filter(Boolean).join(" · ");
}
