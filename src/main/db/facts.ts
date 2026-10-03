// Hechos inmutables: una venta, un pago o un movimiento de inventario se registran una
// vez y no se tocan más (docs/modelo-de-datos.md). Estos disparadores hacen que la propia
// base de datos lo garantice, pase lo que pase en el código.

/** SQL que impide modificar y borrar filas de una tabla de hechos. */
export function immutable(table: string, what: string): string {
  return `
    CREATE TRIGGER ${table}_no_update BEFORE UPDATE ON ${table}
    BEGIN SELECT RAISE(ABORT, '${what} no se modifican: se corrigen con un registro nuevo.'); END;
    CREATE TRIGGER ${table}_no_delete BEFORE DELETE ON ${table}
    BEGIN SELECT RAISE(ABORT, '${what} no se borran: se corrigen con un registro nuevo.'); END;
  `;
}

/** Fecha local del equipo como AAAA-MM-DD: el "día" de la tienda. */
export function localDay(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
