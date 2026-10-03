# 0003 — Dinero en enteros, con librería propia

Fecha: 3 de octubre de 2026 · Estado: aceptada

## Contexto

Ventamas cobra en bolívares, dólares y euros, con tasas que cambian cada día. Un error de un céntimo en una
conversión se nota en el cierre de caja. El PRD proponía dinero.js.

## Decisión

Los montos se guardan y se operan como **enteros en la unidad mínima** de cada moneda (céntimos), con un módulo
propio y pequeño en `src/shared/money`. No se usa dinero.js.

## Reglas

- **Nunca punto flotante para montos.** `money(6500, "USD")` son 65,00 dólares.
- **No se mezclan monedas.** Sumar dólares con bolívares sin convertir lanza un error.
- **Tasa como entero escalado.** Una tasa son las unidades de la moneda pivote (el bolívar) por una unidad de otra
  moneda, con seis decimales de precisión: 866,56 se guarda como 866 560 000.
- **Un solo redondeo por conversión.** La conversión se calcula con enteros grandes (`BigInt`) y se redondea una
  vez, al céntimo más cercano; los empates se alejan de cero. Entre dólar y euro se cruza por el bolívar en una
  sola fracción.
- **El pasado no se recalcula.** Cada venta y cada pago guardarán la tasa con la que se cobraron (fase 1).

## Por qué un módulo propio

Lo que hace falta son unas ochenta líneas: sumar, restar, multiplicar por cantidad, convertir y mostrar. Tenerlas
en el repositorio las hace fáciles de leer y de probar, sin depender de la API de una librería externa. Están
cubiertas por pruebas, incluida la venta de referencia del PRD.

## Consecuencias

- Si más adelante hacen falta operaciones más complejas (repartir un monto en partes, impuestos), se añaden aquí
  o se reconsidera una librería.
- Las monedas con una cantidad de decimales distinta de dos ya están contempladas: cada moneda declara sus
  decimales.
