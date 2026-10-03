// La cuadrícula de tallas y colores del editor de productos: a partir de dos listas
// escritas a mano se generan las piezas, conservando lo ya escrito en cada una.

import { normalize, tidy } from "@shared/text";
import type { Variant } from "../api";

export interface PieceDraft {
  /** Presente si la pieza ya existía en el producto. */
  id?: string;
  size: string;
  color: string;
  code: string;
  /** Texto del campo de existencias. */
  stock: string;
}

export const pieceKey = (size: string, color: string): string => `${normalize(size)}|${normalize(color)}`;

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

/**
 * Las piezas que resultan de cruzar tallas y colores. Lo que ya estaba escrito (código,
 * existencias) se conserva; las combinaciones quitadas a mano no vuelven a aparecer.
 */
export function buildPieces(
  sizes: readonly string[],
  colors: readonly string[],
  previous: readonly PieceDraft[],
  removed: ReadonlySet<string>
): PieceDraft[] {
  const known = new Map(previous.map((piece) => [pieceKey(piece.size, piece.color), piece]));
  const pieces: PieceDraft[] = [];
  for (const size of sizes.length ? sizes : [""]) {
    for (const color of colors.length ? colors : [""]) {
      const key = pieceKey(size, color);
      if (removed.has(key)) continue;
      const old = known.get(key);
      pieces.push({ id: old?.id, size, color, code: old?.code ?? "", stock: old?.stock ?? "0" });
    }
  }
  return pieces;
}

/** Reconstruye las listas del editor a partir de las piezas de un producto guardado. */
export function fromVariants(variants: readonly Variant[]): {
  sizes: string[];
  colors: string[];
  pieces: PieceDraft[];
  removed: Set<string>;
} {
  const sizes = parseList(variants.map((v) => v.size).join(","));
  const colors = parseList(variants.map((v) => v.color).join(","));
  const pieces = variants.map((v) => ({ id: v.id, size: v.size, color: v.color, code: v.code, stock: String(v.stock) }));
  // Lo que falta en la cuadrícula es lo que no se vende: queda como quitado.
  const present = new Set(pieces.map((piece) => pieceKey(piece.size, piece.color)));
  const removed = new Set<string>();
  for (const size of sizes.length ? sizes : [""]) {
    for (const color of colors.length ? colors : [""]) {
      const key = pieceKey(size, color);
      if (!present.has(key)) removed.add(key);
    }
  }
  return { sizes, colors, pieces, removed };
}
