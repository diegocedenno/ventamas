# 0004 — Módulos como carpetas compiladas dentro de la aplicación

Fecha: 3 de octubre de 2026 · Estado: aceptada

## Contexto

Ventamas debe ser modular: un núcleo y funciones que se activan según el tipo de comercio. Lo construye una sola
persona, así que la modularidad no puede costar más de lo que aporta.

## Decisión

Un módulo es una carpeta en `src/modules/<nombre>` con tres partes:

| Archivo | Qué contiene |
|---|---|
| `manifest.ts` | Identificador estable y dependencias. Lo leen las dos mitades. |
| `main/` | Datos y operaciones: migraciones y funciones que la interfaz puede llamar. |
| `renderer/` | Pantallas y su lugar en el menú. |

Los módulos se listan en `src/modules/registry.main.ts` y `registry.renderer.ts`, se ordenan por dependencias y se
compilan dentro de la aplicación. No hay carga dinámica ni tienda de módulos.

El núcleo (`core`) es el único módulo de la fase 0. Trae los ajustes de la tienda y las pantallas de Inicio y
Ajustes.

## Lo que queda para cuando haga falta

- **Activar y desactivar módulos por tienda.** Se añade cuando exista el segundo módulo. Las migraciones de un
  módulo se aplicarán siempre, esté activo o no; desactivarlo solo oculta sus pantallas y operaciones, para que
  reactivarlo nunca encuentre datos a medio migrar.
- **Tipos de comercio.** Cada uno será una lista de módulos activos más unos valores por defecto.
- **Versión de la interfaz entre núcleo y módulos.** Se formaliza antes de aceptar módulos de terceros.

## Para añadir un módulo

1. Crear `src/modules/<nombre>/manifest.ts` con su `id` y sus `depends`.
2. Crear `main/index.ts` (migraciones y operaciones) y `renderer/index.ts` (pantallas).
3. Añadirlo a los dos registros.
