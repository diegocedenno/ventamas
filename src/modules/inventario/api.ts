import type { CurrencyCode } from "@shared/money";

export const INVENTARIO = {
  list: "inventario:list",
  get: "inventario:get",
  save: "inventario:save",
  setActive: "inventario:set-active",
  search: "inventario:search",
} as const;

export const PRODUCT_NAME_MAX = 80;
export const CATEGORY_MAX = 40;
export const VARIANT_TEXT_MAX = 20;
export const CODE_MAX = 40;
export const MAX_VARIANTS = 200;
/** La lista de productos muestra como máximo esta cantidad; con más, hay que buscar. */
export const LIST_LIMIT = 300;

/** Una pieza concreta que se vende: el producto en una talla y un color. */
export interface Variant {
  id: string;
  /** Vacío si el producto no se vende por tallas. */
  size: string;
  /** Vacío si el producto no se vende por colores. */
  color: string;
  /** Código de barras o código propio; vacío si no tiene. */
  code: string;
  /** Existencias: la suma de sus movimientos. Negativo si se vendió sin tener. */
  stock: number;
  active: boolean;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  /** Precio final en unidad mínima de `currency`. */
  price: number;
  /** Costo de compra; null si no se registró. */
  cost: number | null;
  currency: CurrencyCode;
  active: boolean;
  variants: Variant[];
}

/** Fila de la lista de productos. */
export interface ProductSummary {
  id: string;
  name: string;
  category: string;
  price: number;
  currency: CurrencyCode;
  active: boolean;
  /** Tallas y colores en venta. */
  variantCount: number;
  stock: number;
  /** Alguna talla o color quedó en negativo: hay que contar y corregir. */
  needsReview: boolean;
}

export interface VariantInput {
  /** Presente al editar una talla o color que ya existía. */
  id?: string;
  size: string;
  color: string;
  code: string;
  /** Existencias que debe haber después de guardar. */
  stock: number;
}

export interface ProductInput {
  /** Presente al editar. */
  id?: string;
  name: string;
  category: string;
  price: number;
  cost: number | null;
  /** Las tallas y colores en venta. Lo que no venga en la lista deja de venderse. */
  variants: VariantInput[];
}

export interface SearchResult {
  products: Product[];
  /** Si lo buscado es exactamente el código de una pieza, es esta. */
  exact: { productId: string; variantId: string } | null;
}

/** "Zapato deportivo · 38 · Negro" */
export function describeVariant(productName: string, variant: Pick<Variant, "size" | "color">): string {
  return [productName, variant.size, variant.color].filter(Boolean).join(" · ");
}
