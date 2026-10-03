# 0005 — La cuenta del cobro se lleva en valor exacto

Fecha: 3 de octubre de 2026 · Estado: aceptada

## Contexto

Una venta se cobra con varios pagos en monedas distintas y puede dar vuelto en otra moneda. La primera versión de
la cuenta convertía cada pago a la moneda de la venta (dólares) y redondeaba al céntimo en cada paso. La prueba de
extremo a extremo mostró el problema: por algo de 45 $ (38.995,20 Bs) pagado con 40.000 Bs, el vuelto salía
1.005,21 Bs en lugar de 1.004,80 Bs. La diferencia venía de pasar por céntimos de dólar, que valen más de ocho
bolívares cada uno.

## Decisión

La cuenta (`src/modules/ventas/settlement.ts`) se lleva en un **valor exacto**: enteros grandes en moneda local, con
la precisión completa de la tasa. Solo se redondea al expresar un monto en una moneda concreta.

## Reglas

- **Monto exacto.** Si un pago es justo lo que falta expresado en su moneda, salda lo que falta, aunque el
  redondeo deje un resto. Lo mismo con el vuelto. Así, aceptar el monto que la pantalla propone siempre cuadra.
- **Restos mínimos.** Un resto menor que medio céntimo de la moneda de la venta se da por saldado, en ambos
  sentidos: ni queda "falta 0,00" ni se exige devolver céntimos de bolívar.
- **Lo cobrado suma el total.** Lo que cubre cada pago en la moneda de la venta se calcula por diferencia de
  acumulados ya redondeados, de modo que los cobros menos los vueltos dan siempre el total exacto de la venta.
- **Una sola cuenta.** La pantalla y el proceso principal usan la misma función. El proceso principal la repite
  con los precios y las tasas de la base de datos antes de registrar la venta; si no cuadra, no registra nada.
- **Vuelto propuesto.** Se propone en el mismo efectivo con que se pagó de más; quien cobra puede quitarlo y
  repartirlo entre varios medios.

## Consecuencias

- El vuelto en la misma moneda del pago es la resta de toda la vida.
- Cada movimiento de dinero guarda su monto en su moneda, la tasa del momento y su equivalente en la moneda de la
  venta. Los reportes por moneda de venta cuadran con los totales de las ventas.
- La función es pura y está cubierta por pruebas, incluida la venta de referencia del PRD.
