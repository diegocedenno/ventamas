// Validación de lo que llega desde la interfaz al proceso principal. Los mensajes van
// dirigidos a quien usa la aplicación; un dato con forma imposible es un fallo del
// programa y lanza TypeError.

import { UserError } from "./errors";
import { tidy } from "./text";

export function asObject(value: unknown, what = "dato"): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new TypeError(`Se esperaba un objeto en ${what}.`);
  }
  return value as Record<string, unknown>;
}

export function asArray(value: unknown, what = "lista"): unknown[] {
  if (!Array.isArray(value)) throw new TypeError(`Se esperaba una lista en ${what}.`);
  return value;
}

export function asString(value: unknown, what = "texto"): string {
  if (typeof value !== "string") throw new TypeError(`Se esperaba un texto en ${what}.`);
  return value;
}

/** Texto limpio de espacios sobrantes, con un máximo de caracteres. */
export function asText(value: unknown, label: string, max: number, required = false): string {
  const text = tidy(asString(value, label));
  if (required && text === "") throw new UserError(`Falta ${label}.`);
  if (text.length > max) throw new UserError(`${capitalize(label)} no puede pasar de ${max} caracteres.`);
  return text;
}

export function asInteger(value: unknown, what = "número"): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError(`Se esperaba un número entero en ${what}.`);
  }
  return value;
}

export function asBoolean(value: unknown, what = "opción"): boolean {
  if (typeof value !== "boolean") throw new TypeError(`Se esperaba verdadero o falso en ${what}.`);
  return value;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
