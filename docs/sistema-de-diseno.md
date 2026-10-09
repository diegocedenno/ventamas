# Sistema de diseño

Interfaz minimalista para un mostrador: pocas cosas en pantalla, texto grande y controles que se aciertan con el
dedo o con el ratón.

## Reglas

- **Una acción principal por pantalla.** Solo un botón lleva el color de la tienda; los demás son neutros.
- **Todo lo que se toca mide al menos 44 px de alto** (`--control`).
- **Todo se puede hacer con el teclado.** El foco siempre se ve (`--focus`), y el orden de tabulación sigue el
  orden visual.
- **El color nunca es la única señal.** Un estado lleva también texto o icono.
- **Palabras de tienda.** Los textos viven en `src/renderer/src/i18n/es.ts`, separados del código.
- **Iconos de una sola familia** (Lucide, trazo de 1,75). Nada de emojis como iconos.
- **Sin colores sueltos en los componentes.** Solo las variables del tema.
- **Movimiento breve** (150 ms) y solo para dar respuesta; se respeta la preferencia de movimiento reducido.

## Tipografía

Inter, incluida en la aplicación (funciona sin internet). Base de 16 px. Los números de precios y cantidades usan
cifras tabulares (clase `num`) para que las columnas no bailen.

| Variable | Tamaño | Uso |
|---|---|---|
| `--fs-xs` | 12 px | Notas al pie |
| `--fs-sm` | 14 px | Ayudas y etiquetas |
| `--fs-md` | 16 px | Texto |
| `--fs-lg` | 18 px | Títulos de sección |
| `--fs-xl` | 24 px | Cifras destacadas |
| `--fs-2xl` | 32 px | Título de pantalla |

## Espaciado y forma

Espaciado en múltiplos de 4 px (`--s-1` a `--s-7`: 4, 8, 12, 16, 24, 32, 48). Radios de 6, 10 y 14 px.

## Ventana

Barra lateral fija de 240 px con la marca, el nombre de la tienda y el menú (Ajustes va al pie); a la derecha, el
contenido con un ancho máximo de 880 px, o 1180 px en las pantallas con tablas. Ventana mínima de 960 × 600.
Una tienda nueva ve antes el asistente de bienvenida, a ventana completa.

## Componentes compartidos

Viven en `src/renderer/src` y los usan todos los módulos.

| Pieza | Para qué |
|---|---|
| `Dialog` | Ventana modal sobre el `<dialog>` nativo: atrapa el foco, cierra con Esc y devuelve el foco. Empieza en lo marcado con `data-autofocus`. |
| `Field`, `AmountInput` | Campo con etiqueta visible, ayuda y error junto al control; campo de monto con el símbolo de su moneda. |
| `Segmented`, `Chip` | Elegir una entre pocas opciones a la vista (botones de radio de verdad); botón pequeño para filtrar una lista o añadir un valor sugerido con un toque. |
| `SettingSwitch` | Interruptor de un ajuste: responde al instante y vuelve atrás si no se pudo guardar. |
| `ErrorNote`, `Empty` | Aviso de error de una operación; estado vacío que explica qué falta y ofrece el siguiente paso. |
| `Print` | Zona de impresión: dibuja un documento fuera de pantalla, lo mide y lo manda a la impresora o a un PDF. Sirve al rollo del recibo (58 u 80 mm) y a hojas carta y media carta. |
| `useData`, `useOnce`, `call` | Cargar datos del proceso principal; impedir que un doble clic repita una operación; llamar a un canal. |
| `kit.css` | Botones, tablas, insignias, interruptores, pestañas, opciones, cifras destacadas y avisos. |

Cada módulo guarda sus textos (`texts.ts`) y sus estilos propios en su carpeta. Las hojas de estilo de los módulos
se cargan antes que las compartidas: una regla de módulo que cambie un control compartido (`.btn`, `.input`) debe
llevar dos clases para ganar.

## Cómo se amplía una pantalla desde otro módulo

Un módulo no importa pantallas de los que dependen de él. Para que la facturación ponga su botón en la ventana de
una venta, o el inventario su paso en el asistente de bienvenida, cada pantalla anfitriona declara un **lugar** con
nombre (`ventas.sale`, `nucleo.welcome`) y los demás módulos colocan ahí sus piezas (`slots` en su
`RendererModule`). Ajustes funciona igual: cada módulo aporta una sección, que aparece como pestaña.

## Reglas de interacción

- **Deshacer antes que confirmar.** Quitar una línea de la venta se deshace durante unos segundos; solo se pide
  confirmación para lo que no tiene vuelta atrás (vaciar una venta de varias líneas, anular una factura).
- **Lo opcional se despliega.** Las variantes, el precio por pieza y los ajustes de facturación solo aparecen
  cuando se activan.
- **Un aviso no bloquea.** Un RIF cuyo dígito no coincide o una pieza sin existencias se avisan y dejan seguir.
- **Lo no encontrado no desaparece solo.** Un código que no existe queda escrito y avisado hasta que se corrige.

Los documentos impresos (recibo, cierre de caja, factura) van siempre en negro sobre blanco, sea cual sea el tema: es la
única excepción a la regla de no usar colores sueltos.

## Teclado en la pantalla de venta

| Tecla | Qué hace |
|---|---|
| `F2` | Lleva al buscador |
| `F4` | Lleva a los medios de pago |
| `F6` | Elige el cliente |
| `F7` | Descuento a toda la venta |
| `F8` | Deja la venta en espera (o abre las que hay) |
| `F9` | Cobra |

La leyenda está siempre a la vista bajo el botón de cobrar. Tras cada paso el foco pasa solo al siguiente: del
monto al siguiente medio de pago, y de ahí al botón de cobrar cuando la cuenta cuadra.

## Temas

Ocho temas, definidos en un solo archivo: `src/shared/themes.ts`. De ahí salen las variables CSS, el selector de
Ajustes y la prueba de contraste.

| Tema | Carácter |
|---|---|
| Pizarra (por defecto) | Gris azulado con verde |
| Océano | Azul |
| Bosque | Verde oliva sobre crema |
| Terracota | Ladrillo sobre arena |
| Vino | Granate |
| Lavanda | Violeta sobrio |
| Noche | Oscuro azulado con celeste |
| Carbón | Oscuro neutro con ámbar |

Cada tema define dieciséis colores con nombre de función (`bg`, `surface`, `text`, `accent`, `danger`...). La
prueba `src/shared/themes.test.ts` exige contraste AA en veinte combinaciones por tema: 4,5:1 para texto y 3:1
para bordes de controles y foco. Un tema nuevo o un color cambiado que no cumpla hace fallar las pruebas.

## Marca

Una V con un signo de más sobre un cuadrado redondeado. Dentro de la aplicación toma el color del tema; el icono
de Windows usa el verde de Pizarra. El original está en `build/icon.svg`; `npm run icon` genera el `.ico` y el
`.png`.
