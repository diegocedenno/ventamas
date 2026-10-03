/**
 * Error que se le puede mostrar tal cual a la persona que usa la aplicación: el mensaje
 * está en español, en palabras de tienda, y dice qué pasó y cómo seguir.
 * Cualquier otro error es un fallo del programa y se muestra con un texto genérico.
 */
export class UserError extends Error {
  override name = "UserError";
}
