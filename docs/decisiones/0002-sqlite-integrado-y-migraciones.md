# 0002 — SQLite integrado en Node y migraciones propias

Fecha: 3 de octubre de 2026 · Estado: aceptada

## Contexto

Los datos de la tienda viven en un archivo local. El PRD proponía SQLite con Drizzle o Kysely como capa de acceso.

## Decisión

1. **Motor:** el SQLite que trae Node (`node:sqlite`), disponible dentro de Electron 44. No se usa `better-sqlite3`.
2. **Migraciones:** un ejecutor propio (`src/main/db/migrate.ts`). Cada módulo declara sus migraciones como SQL en
   orden; el ejecutor aplica las pendientes, cada una en su transacción.
3. **Capa de consultas:** SQL directo con sentencias preparadas. En la fase 1, con las consultas reales de
   productos, caja y ventas escritas, se decidió seguir así: son pocas, se leen bien y no añaden dependencias.
   Cada módulo concentra su SQL en un archivo (`products.ts`, `cash.ts`, `sales.ts`) y devuelve tipos propios.

## Por qué

- **Sin módulos nativos.** `better-sqlite3` hay que compilarlo para la versión exacta de Electron; el equipo de
  desarrollo no tiene compilador de C++ y la integración continua tendría que hacerlo en cada versión.
  `node:sqlite` no necesita nada de eso.
- **El mismo código en pruebas y en producción.** Las pruebas corren en Node normal y la aplicación en Electron;
  con el motor integrado ambos usan la misma API sin recompilar.
- **Control de la compatibilidad.** Las reglas del PRD (abrir datos de cualquier versión anterior, respaldar antes
  de migrar, no abrir datos de una versión más nueva) son pocas líneas propias y están cubiertas por pruebas.

## Reglas que el ejecutor hace cumplir

- Una migración publicada nunca se edita ni se borra.
- Antes de migrar una base de datos que ya tenía datos, se guarda una copia en `respaldos/` dentro de la carpeta
  de datos. Se conservan las cinco más recientes.
- Si la base de datos tiene migraciones que el programa no conoce, es que viene de una versión más nueva: la
  aplicación no la abre y pide actualizar.
- Si una migración falla, se deshace completa y la aplicación no arranca con datos a medias.
- La prueba `src/modules/migrations.test.ts` guarda la huella de cada migración publicada
  (`migrations.lock.json`) y falla si alguna se edita o desaparece. Una migración nueva se registra con
  `npm run lock-migrations`.

## Hechos inmutables

Las tablas de hechos (ventas, líneas, movimientos de dinero y de inventario, tasas, conteos de cierre) llevan
disparadores que rechazan cualquier `UPDATE` o `DELETE` (`src/main/db/facts.ts`). La regla de "nada se borra" la
garantiza la propia base de datos, no solo el código.

## Durabilidad

La base de datos se abre con `journal_mode = WAL` y `synchronous = FULL`: una operación confirmada sobrevive a un
corte de luz. Toda escritura de varias tablas va dentro de `transaction()`.

## Riesgos

- `node:sqlite` es una API reciente de Node. Funciona sin avisos en Node 24 y en Electron 44, pero su interfaz
  podría cambiar en versiones futuras. Todo el acceso pasa por `src/main/db/database.ts`, así que cambiar de motor
  afectaría a un solo archivo.
- Es una API síncrona en el proceso principal. Para el volumen de una tienda pequeña es adecuado; si una consulta
  pesada llegara a congelar la ventana, se mueve a un proceso aparte.
