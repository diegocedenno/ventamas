# Ventamas

Punto de venta, inventario y clientes para comercios pequeños. Se instala en la computadora del mostrador,
funciona sin internet y cobrará en bolívares, dólares y euros con la tasa del día. Es software libre.

> **Estado: fase 0 (cimientos).** Hoy Ventamas se instala y abre una aplicación con la marca, el nombre de la
> tienda y ocho temas de color. Todavía no vende: las ventas llegan en la fase 1. El plan completo está en el
> [documento de requisitos](docs/PRD.md).

## Qué es

La idea es ofrecer lo que una tienda pequeña necesita de un sistema grande como Odoo, sin su complejidad:

- **Una venta en una sola pantalla**, con cobro en varias monedas y vuelto.
- **Sin internet por defecto.** Los datos viven en el equipo de la tienda.
- **Palabras de tienda**, no jerga contable.
- **Modular.** Cada tipo de comercio ve solo lo que usa.
- **Ayuda dentro del producto**: guía paso a paso, tienda de demostración y manual.

El primer tipo de comercio son las tiendas de ropa y calzado.

## Documentación

| Documento | Contenido |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Qué se va a construir, para quién y en qué orden |
| [docs/investigacion.md](docs/investigacion.md) | Qué existe ya y cómo cobra hoy un comercio pequeño |
| [docs/modelo-de-datos.md](docs/modelo-de-datos.md) | Principios del modelo de datos |
| [docs/sistema-de-diseno.md](docs/sistema-de-diseno.md) | Tipografía, espaciado y los ocho temas |
| [docs/decisiones/](docs/decisiones/) | Decisiones técnicas y sus razones |

## Desarrollo

Requisitos: Windows 10 u 11 y [Node.js](https://nodejs.org) 24 o superior.

```bash
npm install
```

```bash
npm run dev
```

| Comando | Qué hace |
|---|---|
| `npm run dev` | Abre la aplicación con recarga en caliente |
| `npm test` | Pruebas unitarias (dinero, temas, migraciones, ajustes) |
| `npm run typecheck` | Revisión de tipos |
| `npm run build` | Compila la aplicación en `out/` |
| `npm run e2e` | Abre la aplicación compilada y la usa como un usuario |
| `npm run dist` | Genera el instalador de Windows en `dist/` |
| `npm run icon` | Regenera los iconos desde `build/icon.svg` |

En desarrollo los datos se guardan en `%APPDATA%\Ventamas-desarrollo`, aparte de los de la aplicación instalada
(`%APPDATA%\Ventamas`).

### Estructura

```
src/
├─ main/        proceso principal: ventana, base de datos y migraciones
├─ preload/     puente entre la interfaz y el proceso principal
├─ renderer/    interfaz (React): armazón, estilos y textos
├─ shared/      lógica común: dinero, temas, ajustes y contrato de la interfaz
└─ modules/     un módulo por carpeta; hoy solo el núcleo (core)
```

## Licencia

[AGPL-3.0](LICENSE). Puedes usar, modificar e instalar Ventamas libremente. Si distribuyes una versión modificada
o la ofreces como servicio, debes publicar tus cambios bajo la misma licencia.

El nombre «Ventamas» y su logo identifican a este proyecto: una versión modificada debe distribuirse con otro
nombre.

La tipografía Inter se incluye bajo la [SIL Open Font License](src/renderer/src/assets/fonts/OFL-Inter.txt).
