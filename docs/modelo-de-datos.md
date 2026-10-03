# Modelo de datos

Este documento fija los principios del modelo y describe las tablas que existen. Las de cada fase futura se
diseñan en detalle al empezar esa fase; aquí queda el plan para que todas sigan las mismas reglas.

## Principios

1. **Hechos inmutables.** Una venta, un pago, un abono, un movimiento de inventario o un cambio de tasa se
   registran una vez y no se editan ni se borran. Corregir es registrar un hecho nuevo (anulación, devolución,
   ajuste) que apunta al original. La base de datos lo hace cumplir con disparadores.
2. **Los totales se calculan.** No hay un campo "existencia" ni un campo "saldo" que se sobrescriba: son la suma de
   los movimientos. Así un error se rastrea hasta el movimiento que lo causó.
3. **Todo movimiento de dinero tiene medio, monto, moneda y tasa.** Con esa forma, el módulo de finanzas será una
   vista sobre datos que ya existen, y sincronizar varias cajas será intercambiar hechos.
4. **Dinero en enteros.** Montos en unidad mínima y tasas como enteros escalados
   ([decisión 0003](decisiones/0003-dinero-en-enteros.md)).
5. **Cuándo.** Cada hecho guarda su fecha, que es la del equipo. Quién lo registró se añadirá con los usuarios
   (fase 3). Cuando haya sincronización, el orden lo dará el servidor.
6. **Identificadores propios.** Los hechos llevan un identificador único generado en el equipo (no un contador
   global), para que dos cajas nunca choquen cuando llegue la sincronización.
7. **Tablas estrictas.** Todas las tablas son `STRICT`: SQLite rechaza un valor del tipo equivocado.
8. **El momento queda guardado.** Una venta copia la descripción y el precio de cada producto y las tasas con las
   que se cobró. Cambiar después el producto o la tasa no cambia las ventas hechas.

## Tablas

Las marcadas como **hecho** no admiten modificaciones ni borrados.

### Infraestructura y núcleo

| Tabla | Para qué |
|---|---|
| `_migrations` | Qué migraciones de qué módulo se han aplicado. |
| `settings` | Ajustes de la tienda como pares clave-valor: nombre, tema, moneda de los precios, prefijo de las ventas, impresora y ancho del recibo. Son configuración, no hechos. |

### Monedas

| Tabla | Para qué |
|---|---|
| `exchange_rates` (**hecho**) | Cada confirmación de tasa: moneda, tasa escalada, origen (a mano u oficial) y día de la tienda. La tasa vigente es la más reciente. |

### Inventario

| Tabla | Para qué |
|---|---|
| `products` | El producto: nombre, categoría, precio, costo opcional y moneda. Se puede retirar de la venta, pero no borrar. |
| `variants` | La pieza vendible: el producto en una talla y un color, con su código. Un producto sin tallas ni colores tiene una sola. |
| `stock_movements` (**hecho**) | Cada entrada o salida de piezas: existencia inicial, ajuste o venta. Las existencias son la suma. |

### Caja

| Tabla | Para qué |
|---|---|
| `payment_methods` | Los medios de pago, cada uno con su moneda y si es efectivo o electrónico. Se activan y desactivan. |
| `cash_sessions` | Una caja, de su apertura a su cierre. Solo una abierta a la vez. |
| `money_movements` (**hecho**) | Todo el dinero que entra o sale: fondo de apertura, entradas y salidas a mano, cobros de ventas y vueltos. Cada uno con su monto en su moneda, la tasa del momento y, si viene de una venta, su equivalente en la moneda de la venta. |
| `cash_counts` (**hecho**) | El conteo del cierre: lo esperado y lo contado de cada medio. |

### Ventas

| Tabla | Para qué |
|---|---|
| `sales` (**hecho**) | La venta: número (prefijo del equipo y correlativo), caja, moneda, total y las tasas con las que se cobró. |
| `sale_lines` (**hecho**) | Cada línea, con la descripción y el precio del momento. |

Los pagos y vueltos de una venta no tienen tabla propia: son sus filas en `money_movements`.

## Plan por fase

| Fase | Tablas previstas |
|---|---|
| **2. Clientes y crédito** | Clientes · apartados · abonos · movimientos de saldo del cliente (lo que debe y su saldo a favor) · devoluciones, cambios y anulaciones. |
| **3. Control** | Usuarios y roles · registro de acciones sensibles (anulaciones, cambios de precio y de tasa). |
| **Finanzas (2.0)** | Proveedores y compras · gastos y categorías. Las cuentas de dinero ya existen: son los medios de pago. |

## Archivos

- La base de datos es un solo archivo, `ventamas.db`, en la carpeta de datos del usuario
  (`%APPDATA%\Ventamas` en la aplicación instalada).
- Los respaldos automáticos previos a una actualización van a `respaldos/` dentro de esa carpeta.
- Los fallos internos se anotan en `ventamas.log`, en la misma carpeta.
- Los recibos y cierres guardados como PDF van a `Documentos\Ventamas\Recibos`.
- Desinstalar o actualizar la aplicación no borra la carpeta de datos.
