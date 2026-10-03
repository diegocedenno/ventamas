# Modelo de datos

Este documento fija los principios del modelo y lo que ya existe. Las tablas de cada fase se diseñan en detalle
al empezar esa fase; aquí queda el plan para que todas sigan las mismas reglas.

## Principios

1. **Hechos inmutables.** Una venta, un pago, un abono, un movimiento de inventario o un cambio de tasa se
   registran una vez y no se editan ni se borran. Corregir es registrar un hecho nuevo (anulación, devolución,
   ajuste) que apunta al original.
2. **Los totales se calculan.** No hay un campo "existencia" ni un campo "saldo" que se sobrescriba: son la suma de
   los movimientos. Así un error se rastrea hasta el movimiento que lo causó.
3. **Todo movimiento de dinero tiene origen, destino, monto, moneda y tasa.** Con esa forma, el módulo de finanzas
   será una vista sobre datos que ya existen, y sincronizar varias cajas será intercambiar hechos.
4. **Dinero en enteros.** Montos en unidad mínima y tasas como enteros escalados
   ([decisión 0003](decisiones/0003-dinero-en-enteros.md)).
5. **Quién y cuándo.** Cada hecho guarda el usuario que lo registró y la fecha. La fecha es la del equipo; cuando
   haya sincronización, el orden lo dará el servidor.
6. **Identificadores propios.** Los hechos llevan un identificador único generado en el equipo (no un contador
   global), para que dos cajas nunca choquen cuando llegue la sincronización.
7. **Tablas estrictas.** Todas las tablas son `STRICT`: SQLite rechaza un valor del tipo equivocado.

## Lo que existe hoy (fase 0)

| Tabla | Módulo | Para qué |
|---|---|---|
| `_migrations` | infraestructura | Qué migraciones de qué módulo se han aplicado. |
| `settings` | núcleo | Ajustes de la tienda como pares clave-valor (JSON). Hoy: nombre y tema de color. |

Los ajustes son la única excepción al principio de inmutabilidad: son configuración, no hechos del negocio.

## Plan por fase

| Fase | Tablas previstas |
|---|---|
| **1. Vender** | Monedas y tasas (cada tasa es un hecho con fecha y autor) · productos y variantes · ventas, líneas de venta y pagos · movimientos de inventario · sesiones de caja y movimientos de efectivo. |
| **2. Clientes y crédito** | Clientes · apartados · abonos · movimientos de saldo del cliente (lo que debe y su saldo a favor) · devoluciones y cambios. |
| **3. Control** | Usuarios y roles · registro de acciones sensibles (anulaciones, cambios de precio y de tasa). |
| **Finanzas (2.0)** | Proveedores y compras · gastos y categorías · cuentas de dinero (caja, banco, pago móvil). |

## Archivos

- La base de datos es un solo archivo, `ventamas.db`, en la carpeta de datos del usuario
  (`%APPDATA%\Ventamas` en la aplicación instalada).
- Los respaldos automáticos previos a una actualización van a `respaldos/` dentro de esa carpeta.
- Desinstalar o actualizar la aplicación no borra la carpeta de datos.
