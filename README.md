# Ventamas

Punto de venta, inventario y clientes para comercios pequeños. Se instala en la computadora del mostrador,
funciona sin internet y cobra en bolívares, dólares y euros con la tasa del día. Es software libre.

![Pantalla de venta: una venta de 65 dólares con 40 pagados en efectivo y lo que falta en bolívares y euros](docs/capturas/vender.png)

> **Estado: versión 0.2, de prueba.** Ya se puede vender y cerrar la caja. Todavía faltan los clientes, el fiado,
> las devoluciones y los usuarios con permisos: no la uses aún como único registro de tu tienda. El plan completo
> está en el [documento de requisitos](docs/PRD.md).

## Qué hace hoy

- **Vender en una sola pantalla.** Busca por nombre o escanea el código de barras, elige talla y color, y cobra.
  Se puede hacer toda la venta solo con el teclado.
- **Cobrar en varias monedas.** Varios pagos en una misma venta, en bolívares, dólares o euros. Tras cada pago
  dice cuánto falta en cada moneda, y propone el vuelto en la moneda que convenga.
- **Tasa del día.** Se confirma una vez al día. Se puede escribir a mano o traer la tasa oficial del BCV (con
  internet) para revisarla. Cada venta guarda la tasa con la que se cobró.
- **Productos con tallas y colores**, cada combinación con sus existencias y su código. Vender descuenta del
  inventario; lo que se vende sin tener queda marcado para revisar.
- **Caja.** Apertura con fondo inicial, entradas y salidas de efectivo, y cierre con conteo por medio de pago,
  que muestra lo que sobra o falta.
- **Recibo no fiscal**, para impresora térmica de 58 u 80 mm o como PDF.
- **Sin internet.** Los datos viven en el equipo de la tienda. Nada sale de él.
- **Ocho temas de color** y el nombre de la tienda.

| Crear un producto | Cerrar la caja |
|---|---|
| ![Editor de producto con tallas, colores, códigos y existencias](docs/capturas/producto.png) | ![Cierre de caja con lo esperado, lo contado y la diferencia de cada medio de pago](docs/capturas/cierre.png) |

### Importante

- **El recibo no es una factura.** Si tu comercio está obligado a facturar con máquina fiscal o talonario, debe
  seguir haciéndolo.
- **La impresión en impresora térmica no se ha probado con un equipo real.** El recibo se generó y revisó como
  PDF con el tamaño del papel.
- **Windows mostrará un aviso de "editor desconocido"** al instalar, porque el instalador no tiene firma digital.

## Qué viene

Clientes, apartados y fiado, cambios y devoluciones, inventario completo, reportes, usuarios con permisos,
respaldo, y la ayuda dentro del producto. Después, finanzas básicas. El orden está en el
[plan de crecimiento](docs/PRD.md#11-plan-de-crecimiento).

## Documentación

| Documento | Contenido |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Qué se va a construir, para quién y en qué orden |
| [docs/investigacion.md](docs/investigacion.md) | Qué existe ya y cómo cobra hoy un comercio pequeño |
| [docs/modelo-de-datos.md](docs/modelo-de-datos.md) | Principios del modelo de datos y tablas |
| [docs/sistema-de-diseno.md](docs/sistema-de-diseno.md) | Tipografía, espaciado, componentes y los ocho temas |
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
| `npm test` | Pruebas unitarias: dinero, cobro, productos, caja, ventas, migraciones |
| `npm run typecheck` | Revisión de tipos |
| `npm run build` | Compila la aplicación en `out/` |
| `npm run e2e` | Abre la aplicación compilada y recorre un día completo de una tienda |
| `npm run dist` | Genera el instalador de Windows en `dist/` |
| `npm run lock-migrations` | Registra las migraciones nuevas (ver [decisión 0002](docs/decisiones/0002-sqlite-integrado-y-migraciones.md)) |
| `npm run icon` | Regenera los iconos desde `build/icon.svg` |

En desarrollo los datos se guardan en `%APPDATA%\Ventamas-desarrollo`, aparte de los de la aplicación instalada
(`%APPDATA%\Ventamas`).

### Estructura

```
src/
├─ main/        proceso principal: ventana, base de datos, migraciones e impresión
├─ preload/     puente entre la interfaz y el proceso principal
├─ renderer/    interfaz (React): armazón, componentes y estilos compartidos
├─ shared/      lógica común: dinero, temas, ajustes y validación
└─ modules/     un módulo por carpeta: nucleo, monedas, inventario, caja, ventas
```

Cada módulo tiene su contrato (`api.ts`), sus datos y operaciones (`main/`) y sus pantallas (`renderer/`). Cómo
añadir uno está en la [decisión 0004](docs/decisiones/0004-modulos-compilados.md).

## Licencia

[AGPL-3.0](LICENSE). Puedes usar, modificar e instalar Ventamas libremente. Si distribuyes una versión modificada
o la ofreces como servicio, debes publicar tus cambios bajo la misma licencia.

El nombre «Ventamas» y su logo identifican a este proyecto: una versión modificada debe distribuirse con otro
nombre.

La tipografía Inter se incluye bajo la [SIL Open Font License](src/renderer/src/assets/fonts/OFL-Inter.txt).
