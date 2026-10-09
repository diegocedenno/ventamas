# Modelo de datos

Este documento fija los principios del modelo y describe las tablas que existen. Las de cada fase futura se
diseñan en detalle al empezar esa fase; aquí queda el plan para que todas sigan las mismas reglas.

## Principios

1. **Hechos inmutables.** Una venta, un pago, un abono, un movimiento de inventario, una factura o un cambio de
   tasa se registran una vez y no se editan ni se borran. Corregir es registrar un hecho nuevo (anulación,
   devolución, ajuste) que apunta al original. La base de datos lo hace cumplir con disparadores.
2. **Los totales se calculan.** No hay un campo "existencia" ni un campo "saldo" que se sobrescriba: son la suma de
   los movimientos. Así un error se rastrea hasta el movimiento que lo causó.
3. **Todo movimiento de dinero tiene medio, monto, moneda y tasa.** Con esa forma, el módulo de finanzas será una
   vista sobre datos que ya existen, y sincronizar varias cajas será intercambiar hechos.
4. **Dinero en enteros.** Montos en unidad mínima y tasas como enteros escalados
   ([decisión 0003](decisiones/0003-dinero-en-enteros.md)). Los porcentajes y las tasas de impuesto van en
   centésimas de punto (1600 = 16 %), y los repartos suman exacto
   ([decisión 0007](decisiones/0007-descuentos-e-impuestos.md)).
5. **Cuándo.** Cada hecho guarda su fecha, que es la del equipo. Quién lo registró se añadirá con los usuarios
   (fase 3). Cuando haya sincronización, el orden lo dará el servidor.
6. **Identificadores propios.** Los hechos llevan un identificador único generado en el equipo (no un contador
   global), para que dos cajas nunca choquen cuando llegue la sincronización.
7. **Tablas estrictas.** Todas las tablas son `STRICT`: SQLite rechaza un valor del tipo equivocado.
8. **El momento queda guardado.** Una venta copia la descripción, el precio, el impuesto y el costo de cada
   producto, el nombre y el documento de su cliente, y las tasas con las que se cobró. Una factura copia los datos
   del cliente y de la tienda. Cambiar después el producto, el cliente o la tasa no cambia lo ya hecho.

## Tablas

Las marcadas como **hecho** no admiten modificaciones ni borrados.

### Infraestructura y núcleo

| Tabla | Para qué |
|---|---|
| `_migrations` | Qué migraciones de qué módulo se han aplicado. |
| `settings` | Ajustes de la tienda como pares clave-valor: nombre, RIF, dirección, tema, moneda de los precios, impresora, impuestos, facturación. Son configuración, no hechos. |

### Monedas

| Tabla | Para qué |
|---|---|
| `exchange_rates` (**hecho**) | Cada confirmación de tasa: moneda, tasa escalada, origen (a mano u oficial) y día de la tienda. La tasa vigente es la más reciente. |

### Impuestos

| Tabla | Para qué |
|---|---|
| `tax_classes` | Las tasas que puede llevar un producto: general (16 %), reducida (8 %) y exento, editables. Cada venta guarda la tasa con la que se cobró. |

### Inventario

| Tabla | Para qué |
|---|---|
| `categories` | Las categorías de la tienda. Cada una lleva su plantilla de variantes: el nombre de sus dos ejes y sus valores habituales. Pueden venir del catálogo incluido o crearse a mano. |
| `loaded_rubros` | Qué rubros del catálogo incluido cargó ya la tienda. |
| `products` | El producto o servicio: nombre, tipo, categoría, precio, costo, moneda, el nombre de sus ejes de variante, existencia mínima, si el precio se escribe al vender y qué impuesto lleva. Se puede retirar de la venta, pero no borrar. |
| `variants` | La pieza vendible: el producto en una combinación de sus variantes, con su código y, si los tiene, su precio y su costo propios. Un producto sin variantes tiene una sola. |
| `stock_movements` (**hecho**) | Cada entrada o salida de piezas, con su motivo (existencia inicial, llegada de mercancía, conteo, daño, pérdida, uso propio, venta), una nota y, en las entradas, el costo. Las existencias son la suma. Los servicios no tienen. |

### Caja

| Tabla | Para qué |
|---|---|
| `payment_methods` | Los medios de pago, cada uno con su moneda y si es efectivo o electrónico. Se activan y desactivan. |
| `cash_sessions` | Una caja, de su apertura a su cierre. Solo una abierta a la vez. |
| `money_movements` (**hecho**) | Todo el dinero que entra o sale: fondo de apertura, entradas y salidas a mano, cobros de ventas y vueltos. Cada uno con su monto en su moneda, la tasa del momento y, si viene de una venta, su equivalente en la moneda de la venta. |
| `cash_counts` (**hecho**) | El conteo del cierre: lo esperado y lo contado de cada medio. |

### Clientes

| Tabla | Para qué |
|---|---|
| `customers` | Nombre, cédula o RIF, teléfono, correo, dirección y nota. Un cliente se archiva, no se borra. Dos clientes activos no comparten documento. |

### Ventas

| Tabla | Para qué |
|---|---|
| `sales` (**hecho**) | La venta: número (prefijo del equipo y correlativo), caja, moneda, total, las tasas de cambio con las que se cobró, el cliente (con el nombre y el documento que tenía), el descuento general, el impuesto y una nota. |
| `sale_lines` (**hecho**) | Cada línea, con la descripción y el precio del momento, su descuento propio, su parte del descuento general, su impuesto y lo que costaba la pieza. |
| `sale_taxes` (**hecho**) | El desglose de impuestos de la venta: base e impuesto de cada tasa. Vacío si la tienda no desglosa impuestos. |
| `parked_sales` | Ventas en espera: líneas, descuento y cliente de una venta a medio armar. No son hechos: se borran al retomarlas o descartarlas. |

Los pagos y vueltos de una venta no tienen tabla propia: son sus filas en `money_movements`.

### Facturación

| Tabla | Para qué |
|---|---|
| `control_lots` | Cada lote de formas libres entregado por la imprenta: su rango de números de control. |
| `invoices` (**hecho**) | Una factura: emitida por Ventamas en forma libre o emitida por otro medio y anotada. Guarda su número, su número de control, la venta, y los datos del cliente y de la tienda tal como salieron. |
| `invoice_voids` (**hecho**) | La anulación de una factura, con su motivo. La venta no cambia. |
| `voided_sheets` (**hecho**) | Hojas del lote que se dañaron sin llegar a ser factura. |

## Plan por fase

| Fase | Tablas previstas |
|---|---|
| **2. Clientes y crédito** | Apartados · abonos · movimientos de saldo del cliente (lo que debe y su saldo a favor) · devoluciones, cambios y anulaciones de ventas · notas de crédito. Los clientes ya existen. |
| **3. Control** | Usuarios y roles · registro de acciones sensibles (anulaciones, descuentos, cambios de precio y de tasa). |
| **Finanzas (2.0)** | Proveedores y compras · gastos y categorías. Las cuentas de dinero ya existen (son los medios de pago), y cada línea vendida ya guarda su costo. |

## Archivos

- La base de datos es un solo archivo, `ventamas.db`, en la carpeta de datos del usuario
  (`%APPDATA%\Ventamas` en la aplicación instalada).
- Los respaldos automáticos previos a una actualización van a `respaldos/` dentro de esa carpeta.
- Los fallos internos se anotan en `ventamas.log`, en la misma carpeta.
- Lo que la persona pide guardar va a `Documentos\Ventamas`: recibos, cierres y copias de facturas en `Recibos`, y
  el auxiliar del libro de ventas en `Libros`.
- Desinstalar o actualizar la aplicación no borra la carpeta de datos.
