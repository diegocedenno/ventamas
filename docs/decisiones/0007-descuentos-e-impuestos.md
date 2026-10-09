# 0007 — Descuentos e impuestos: una sola cuenta y un redondeo por tasa

Fecha: 9 de octubre de 2026 · Estado: aceptada

## Contexto

Al añadir descuentos (por línea y a toda la venta) e impuestos aparecen los céntimos sueltos: un 10 % sobre tres
líneas de 33,33 no se reparte en partes iguales, y el impuesto calculado línea por línea no coincide con el
calculado sobre el total. Los puntos de venta conocidos no se ponen de acuerdo: Shopify redondea por línea, Square
calcula sobre el agregado y reparte, y Odoo recomienda una u otra cosa según los precios incluyan o no el impuesto
([investigación, apartado 7.3](../investigacion.md)).

En Venezuela, además, el precio que ve el cliente suele ser final: el total de la venta no puede moverse un
céntimo porque se desglose el impuesto.

## Decisión

Toda la cuenta de una venta la hace una función pura, `price()` (`src/modules/ventas/pricing.ts`), en este orden:

1. **Descuento de cada línea**, como monto sobre toda la línea.
2. **Descuento general**, en porcentaje o en monto, calculado sobre lo que queda después de los de línea.
3. **Reparto del descuento general entre las líneas**, en proporción a lo que vale cada una.
4. **Impuesto, una vez por cada tasa**, sobre el total de sus líneas ya descontadas.
5. **Reparto del impuesto de cada tasa entre sus líneas.**

Los repartos usan `allocate()` (`src/shared/money/allocate.ts`): partes enteras que suman exactamente el total; los
céntimos sueltos van a las partes con mayor resto.

## Reglas

- **Precios con el impuesto incluido (por defecto).** El total es la suma de los precios. La base de cada tasa es
  lo cobrado entre uno más la tasa, redondeado una vez; el impuesto es lo cobrado menos la base. Así base más
  impuesto dan siempre el total.
- **Precios sin impuesto.** El impuesto de cada tasa se calcula una vez sobre su base y se suma al total.
- **Tasas y porcentajes en centésimas de punto** (1600 = 16 %), como enteros.
- **La venta guarda el resultado, no la fórmula.** Cada línea guarda su descuento propio, su parte del descuento
  general, su impuesto, su tasa y lo que costaba la pieza; la venta guarda el desglose por tasa (`sale_taxes`).
  Cambiar después una tasa no cambia las ventas hechas.
- **Una sola cuenta.** La pantalla la usa para mostrar el total mientras se arma la venta; el proceso principal la
  repite con los precios y las tasas de la base de datos antes de registrar. Si el total no coincide con el que vio
  quien cobra, no se registra nada.
- **Los impuestos vienen apagados.** Una tienda que no los desglosa no ve nada de esto y sus ventas no guardan
  desglose.

## Consecuencias

- La suma de las líneas coincide con el total al céntimo, y la de las bases e impuestos por tasa también. Una
  devolución parcial, cuando exista, sabrá cuánto vale exactamente cada línea.
- El impuesto de una línea aislada puede diferir en un céntimo del que saldría calculándolo solo para ella. Es el
  precio de que cuadre el total, que es lo que se declara.
- Guardar el costo de cada pieza al venderla (`sale_lines.unit_cost`) deja lista la pregunta «¿cuánto gané?» de las
  finanzas básicas.
- El IGTF no se calcula: solo lo perciben los sujetos pasivos especiales, y no hay criterio oficial sobre su base
  en pagos mixtos. Ver la [decisión 0008](0008-facturacion.md).
