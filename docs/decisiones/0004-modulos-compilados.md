# 0004 — Módulos como carpetas compiladas dentro de la aplicación

Fecha: 3 de octubre de 2026 · Estado: aceptada

## Contexto

Ventamas debe ser modular: un núcleo y funciones que se activan según el tipo de comercio. Lo construye una sola
persona, así que la modularidad no puede costar más de lo que aporta.

## Decisión

Un módulo es una carpeta en `src/modules/<nombre>` con cuatro partes:

| Archivo | Qué contiene |
|---|---|
| `manifest.ts` | Identificador estable y dependencias. Lo leen las dos mitades. |
| `api.ts` | El contrato del módulo: nombres de sus canales y tipos de lo que entra y sale. |
| `main/` | Datos y operaciones: migraciones y funciones que la interfaz puede llamar. |
| `renderer/` | Pantallas, su lugar en el menú, bloques para Ajustes, textos y estilos propios. |

La carpeta se llama igual que el identificador del módulo, en español, porque es el nombre que verá el dueño de
la tienda al activar módulos: `nucleo`, `monedas`, `inventario`, `caja`, `ventas`.

Los módulos se listan en `src/modules/registry.main.ts` y `registry.renderer.ts`, se ordenan por dependencias y se
compilan dentro de la aplicación. No hay carga dinámica ni tienda de módulos.

Módulos existentes y sus dependencias:

| Módulo | Depende de | Qué trae |
|---|---|---|
| `nucleo` | — | Ajustes de la tienda, temas, pantalla de Ajustes. |
| `monedas` | núcleo | Tasas del día y su historial. |
| `inventario` | núcleo | Productos, tallas y colores, existencias. |
| `caja` | núcleo | Medios de pago, apertura y cierre, movimientos de dinero. |
| `ventas` | núcleo, monedas, inventario, caja | Pantalla de venta, cobro, recibo. |

Un módulo usa a otro importando sus funciones (en el proceso principal) o sus componentes (en la interfaz), y
solo en el sentido de sus dependencias. Por eso los cobros de una venta se guardan en la tabla de movimientos de
dinero de `caja`: `ventas` depende de `caja`, no al revés.

## Cómo habla la interfaz con los datos

Cada operación tiene un canal con nombre (`ventas:create`). La interfaz la llama con `call()` y recibe el valor o
un error ya escrito para mostrarlo. En el proceso principal, una operación que lanza `UserError` le habla a la
persona; cualquier otro error se anota en `ventamas.log` y la persona ve un mensaje genérico.

## Lo que queda para cuando haga falta

- **Activar y desactivar módulos por tienda.** Se añade con el asistente inicial (fase 4), que es quien elige
  los módulos según el tipo de comercio. Las migraciones de un
  módulo se aplicarán siempre, esté activo o no; desactivarlo solo oculta sus pantallas y operaciones, para que
  reactivarlo nunca encuentre datos a medio migrar.
- **Tipos de comercio.** Cada uno será una lista de módulos activos más unos valores por defecto.
- **Versión de la interfaz entre núcleo y módulos.** Se formaliza antes de aceptar módulos de terceros.

## Para añadir un módulo

1. Crear `src/modules/<nombre>/manifest.ts` con su `id` y sus `depends`, y `api.ts` con sus canales y tipos.
2. Crear `main/index.ts` (migraciones y operaciones) y `renderer/index.ts` (pantallas).
3. Añadirlo a los dos registros.
4. Registrar sus migraciones con `npm run lock-migrations`.
