// La cuadrícula de variantes del editor de productos: a partir de las dos listas de
// valores (tallas y colores, capacidades y colores…) se generan las piezas, conservando
// lo ya escrito en cada una.

import { normalize, tidy } from "@shared/text";
import type { Variant } from "../api";

export interface PieceDraft {
  /** Presente si la pieza ya existía en el producto. */
  id?: string;
  value1: string;
  value2: string;
  code: string;
  /** Texto del campo de existencias. */
  stock: string;
  /** Texto del campo de precio propio; vacío si usa el del producto. */
  price: string;
  /** Texto del campo de costo propio; vacío si usa el del producto. */
  cost: string;
}

export const pieceKey = (value1: string, value2: string): string => `${normalize(value1)}|${normalize(value2)}`;

/** "36, 37 ,38" → ["36", "37", "38"], sin vacíos ni repetidos. */
export function parseList(text: string): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const raw of text.split(/[,;\n]/)) {
    const item = tidy(raw);
    const key = normalize(item);
    if (item === "" || seen.has(key)) continue;
    seen.add(key);
    items.push(item);
  }
  return items;
}

/** Añade un valor a una lista escrita a mano, o lo quita si ya estaba. */
export function toggleInList(text: string, value: string): string {
  const items = parseList(text);
  const key = normalize(value);
  const without = items.filter((item) => normalize(item) !== key);
  return (without.length === items.length ? [...items, value] : without).join(", ");
}

/**
 * Las piezas que resultan de cruzar las dos listas de valores. Lo que ya estaba escrito
 * (código, existencias, precio) se conserva; las combinaciones quitadas a mano no vuelven
 * a aparecer.
 */
export function buildPieces(
  values1: readonly string[],
  values2: readonly string[],
  previous: readonly PieceDraft[],
  removed: ReadonlySet<string>
): PieceDraft[] {
  const known = new Map(previous.map((piece) => [pieceKey(piece.value1, piece.value2), piece]));
  const pieces: PieceDraft[] = [];
  for (const value1 of values1.length ? values1 : [""]) {
    for (const value2 of values2.length ? values2 : [""]) {
      const key = pieceKey(value1, value2);
      if (removed.has(key)) continue;
      const old = known.get(key);
      pieces.push({
        id: old?.id,
        value1,
        value2,
        code: old?.code ?? "",
        stock: old?.stock ?? "0",
        price: old?.price ?? "",
        cost: old?.cost ?? "",
      });
    }
  }
  return pieces;
}

/**
 * Reconstruye las listas del editor a partir de las piezas de un producto guardado.
 * `amount` escribe un monto como texto de campo ("45,00").
 */
export function fromVariants(
  variants: readonly Variant[],
  amount: (value: number) => string
): {
  values1: string[];
  values2: string[];
  pieces: PieceDraft[];
  removed: Set<string>;
} {
  const values1 = parseList(variants.map((v) => v.value1).join(","));
  const values2 = parseList(variants.map((v) => v.value2).join(","));
  const pieces = variants.map((v) => ({
    id: v.id,
    value1: v.value1,
    value2: v.value2,
    code: v.code,
    stock: String(v.stock),
    price: v.price === null ? "" : amount(v.price),
    cost: v.cost === null ? "" : amount(v.cost),
  }));
  // Lo que falta en la cuadrícula es lo que no se vende: queda como quitado.
  const present = new Set(pieces.map((piece) => pieceKey(piece.value1, piece.value2)));
  const removed = new Set<string>();
  for (const value1 of values1.length ? values1 : [""]) {
    for (const value2 of values2.length ? values2 : [""]) {
      const key = pieceKey(value1, value2);
      if (!present.has(key)) removed.add(key);
    }
  }
  return { values1, values2, pieces, removed };
}

/** Margen sobre el precio y ganancia por pieza; null si falta el costo o el precio es cero. */
export function marginOf(price: number, cost: number | null): { profit: number; margin: number; markup: number | null } | null {
  if (cost === null || price <= 0) return null;
  const profit = price - cost;
  return {
    profit,
    // En décimas de punto: 378 = 37,8 %.
    margin: Math.round((profit * 1000) / price),
    markup: cost > 0 ? Math.round((profit * 1000) / cost) : null,
  };
}
