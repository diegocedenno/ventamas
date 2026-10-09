# 0008 — Facturación: qué hace Ventamas y qué no

Fecha: 9 de octubre de 2026 · Estado: aceptada · Normas revisadas: octubre de 2026

> Esto no es asesoría legal. Las normas se leyeron en transcripciones y boletines de firmas, no en la Gaceta
> Oficial, y el régimen está en transición desde agosto de 2026. Cada comercio debe confirmar su caso con un
> contador. Las fuentes están en la [investigación, apartado 7.1](../investigacion.md).

## Contexto

Se pidió que Ventamas pudiera facturar. La investigación encontró tres hechos que mandan sobre todo lo demás:

1. **Un programa no convierte un documento en factura.** La Providencia SNAT/2011/00071 admite tres medios:
   formatos o formas libres de una imprenta autorizada, máquinas fiscales, y (por providencia posterior) imprentas
   digitales autorizadas.
2. **Ropa y calzado están en la lista de máquina fiscal obligatoria** (art. 8), junto con comidas y bebidas,
   belleza y estética, lavado de carros, estacionamientos y fotocopiado, entre otras. La obligación exige además
   vender sobre todo a consumidores finales y superar 1.500 unidades tributarias al año de ingresos, un umbral que
   hoy equivale a unos 74 dólares: casi cualquier tienda lo supera.
3. **Emitir documentos que informen montos en lugar de la factura está sancionado** (Código Orgánico Tributario,
   art. 101), con clausura y multa. La homologación de software que existió en 2025 fue derogada en agosto de 2026
   sin régimen sustituto.

Es decir: el primer comercio de Ventamas, la tienda de ropa, no puede facturar desde un programa de escritorio.

## Decisión

La facturación es un módulo aparte, **apagado por defecto**, con tres modos:

| Modo | Para quién | Qué hace Ventamas |
|---|---|---|
| **Apagado** | Quien no factura con Ventamas | Solo su recibo, rotulado «NO FISCAL» |
| **Otro medio** | Quien factura con máquina fiscal, talonario o imprenta digital | En cada venta se anota el número de la factura emitida fuera; queda en la venta y en el auxiliar del libro |
| **Formas libres** | Quien no está obligado a máquina fiscal | Numera la factura y la imprime sobre las hojas con número de control de una imprenta autorizada |

## Qué hace el modo de formas libres

- **Numeración consecutiva y única**, con serie opcional. Nunca rellena huecos ni retrocede.
- **Lote de formas libres**: se registra el rango de números de control que entregó la imprenta. Ventamas propone
  la hoja que toca y quien emite la confirma con la que está en la impresora. Un número de control se usa una vez.
- **Contenido** (art. 13): la palabra «Factura», su número, la fecha con ocho dígitos, nombre y cédula o RIF del
  cliente, cantidad, descripción y monto de cada línea, `(E)` en lo exento, los descuentos, la base y el impuesto
  de cada tasa, y el total. Si la venta fue en divisas, también el tipo de cambio y el equivalente en bolívares.
- **Contribuyente formal**: sin desglose de impuesto y con su leyenda.
- **Anular**: la factura queda anulada con su motivo y la venta sigue en pie; se puede emitir otra, con el número
  y la hoja siguientes. Una hoja que se daña antes de ser factura también se anula.
- **Auxiliar del Libro de Ventas**: las facturas del mes con base, impuesto y exento en bolívares, a la tasa de
  cada venta, exportable a hoja de cálculo. No es el libro oficial.
- **Copia de archivo en PDF**, marcada «SIN VALIDEZ FISCAL»: la factura es la hoja impresa.

## Qué no hace, a propósito

- **No genera números de control.** Son de la imprenta.
- **No imprime «Factura» en papel común** como si valiera: la copia en PDF lo dice arriba.
- **No habla con máquinas fiscales.** Sus protocolos son propietarios, el desarrollador debe registrarse ante cada
  fabricante (SNAT/2018/0141, arts. 51 y 52) y no hay equipo con que probarlo. Es el camino realista para la tienda
  de ropa y queda como trabajo futuro, idealmente con ayuda de quien tenga una.
- **No se conecta con imprentas digitales.** Exige autorización del SENIAT y contrato con la imprenta.
- **No calcula IGTF.** Solo lo perciben los sujetos pasivos especiales.
- **No emite notas de crédito ni de débito.** Llegarán con las devoluciones.
- **No decide por el comercio.** Antes de activar las formas libres, la pantalla explica las tres condiciones que
  obligan a máquina fiscal y dice qué hacer si se cumplen. La responsabilidad es de quien emite.

## Consecuencias

- Una factura y su anulación son hechos inmutables, como las ventas.
- La factura no toca la venta: la venta existe igual con factura o sin ella. Por eso un contribuyente ordinario
  solo puede facturar ventas cobradas con el impuesto desglosado.
- El recibo no fiscal sigue existiendo y sigue diciendo que no es una factura. El riesgo de entregarlo en lugar de
  la factura es del comercio, y ya estaba aceptado en el PRD.
- Si cambian las tasas, las leyendas o el régimen, se cambia este módulo sin tocar ventas ni inventario.
