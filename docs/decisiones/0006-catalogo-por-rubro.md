# 0006 — Variantes con nombre propio y un catálogo por rubro escrito a mano

Fecha: 9 de octubre de 2026 · Estado: aceptada

## Contexto

La versión 0.2 solo entendía tallas y colores: servía a una tienda de ropa o de zapatos y a nadie más. Un teléfono
se vende por capacidad y color; una pintura, por color y presentación; un corte de cabello, por quién lo recibe.
Además, quien instala Ventamas empezaba con el catálogo vacío y tenía que inventar sus categorías.

Se investigó si convenía adoptar una taxonomía abierta ([investigación, apartado 7.2](../investigacion.md)):

| Taxonomía | Tamaño | ¿Se puede redistribuir? | Problema para una tienda pequeña |
|---|---|---|---|
| Shopify Standard Product Taxonomy | 14.606 categorías, 8.240 atributos | Sí (MIT) | Atributos descriptivos, no ejes de variante; español peninsular («camisetas», «neumáticos»); servicios casi ausentes |
| Google Product Taxonomy | 5.595 categorías | Sin licencia publicada | No trae atributos |
| GS1 GPC | 5.318 «bricks» | No, sin permiso escrito | Pensada para la cadena de suministro |

Una tienda pequeña usa entre seis y doce categorías. Ninguna taxonomía dice «en ropa los ejes son talla y color»:
dan decenas de atributos y dejan esa decisión al comerciante.

## Decisión

1. **Dos ejes de variante por producto, cada uno con el nombre que haga falta.** El producto guarda los nombres
   (`option1`, `option2`: «Talla» y «Color», «Capacidad» y «Color», «Presentación»); cada pieza guarda sus valores
   (`value1`, `value2`). Un producto sin variantes tiene una sola pieza.
2. **Cada pieza puede tener su precio y su costo.** Si no los tiene, usa los del producto. Hace falta en cuanto las
   variantes dejan de ser tallas: un galón no cuesta lo que un cuarto.
3. **Las categorías llevan una plantilla de variantes**: el nombre de cada eje y sus valores habituales. Al crear un
   producto y elegir su categoría, los ejes ya vienen puestos y los valores se añaden con un toque.
4. **Un catálogo propio, corto y escrito a mano** (`src/modules/inventario/main/catalog.ts`): 25 rubros con unas
   300 categorías, en el vocabulario de una tienda venezolana (franelas, cauchos, koalas, bombillos, paños). Al
   instalar se eligen uno o varios rubros y se cargan sus categorías; también se pueden cargar después.
5. **Los servicios son productos sin existencias.** Un servicio puede tener modalidades (corte de dama o de
   caballero, lavado de carro o de camioneta) con el mismo mecanismo de variantes, y puede tener el precio abierto:
   se escribe al cobrar.

## Reglas

- **El catálogo es un punto de partida, no una norma.** Cargar un rubro no pisa nada: una categoría que la tienda
  ya tenía se respeta, y solo recibe la plantilla si no tenía ninguna. Se puede repetir sin duplicar.
- **Un tercer eje se resuelve sin tercer eje.** Con un valor combinado («8/256 GB», «34B») o dejando el tercero en
  el nombre del producto («Pintura de caucho mate»). La investigación encontró siete casos y ninguno obliga a más.
- **El producto copia los nombres de sus ejes.** Cambiar después la plantilla de la categoría no cambia los
  productos ya creados.
- **Las tallas y medidas del catálogo son las habituales, no una tabla oficial.** Varias no se pudieron contrastar
  con un comercio real; se corrigen en Ajustes y en el propio archivo.

## Consecuencias

- La migración `inventario/0002_catalogo` renombra `size` y `color` a `value1` y `value2`, da nombre a los ejes de
  los productos existentes («Talla», «Color») y convierte en categorías los textos que la tienda había escrito. La
  prueba de actualización desde la 0.2 lo comprueba con datos reales de esa versión.
- El buscador y los informes no distinguen rubros: una tienda puede mezclar zapatos, forros de teléfono y cortes de
  cabello.
- **Queda fuera la venta por peso o por metro** (queso por kilo, cable por metro, lavado por kilo). Hoy las
  cantidades son enteras; el catálogo ofrece presentaciones («250 g», «1 kg») como salida provisional. Es el
  siguiente paso natural para abastos, ferreterías y lavanderías.
- El modelo admite dos ejes. Los puntos de venta conocidos admiten tres; añadir el tercero sería una columna más y
  no cambia lo ya guardado.
