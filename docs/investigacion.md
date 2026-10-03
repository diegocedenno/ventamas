# Ventamas — investigación previa

Fecha: 3 de octubre de 2026. Tres búsquedas en paralelo: código abierto existente, mercado y normativa
(Venezuela primero) y opciones técnicas. Este documento es la base del PRD.

Cómo leer las marcas: **[V]** leído en la fuente enlazada · **[B]** visto solo en el resumen de un buscador ·
**[I]** inferencia · **[NV]** no verificado. Las normas y cifras de 2026 vienen de las fuentes citadas y no se
contrastaron con una fuente primaria (Gaceta Oficial, SENIAT, BCV). Algunas fechas de "último release" coinciden
con el día de la búsqueda y pueden ser un artefacto de la herramienta de lectura: confirmar antes de citarlas.

## 1. Conclusión en cinco líneas

1. No apareció ningún proyecto abierto y autónomo que junte venta sin conexión con sincronización, cobro real en
   dos monedas y simplicidad. El hueco existe.
2. El hueco es de empaquetado y de contexto venezolano, no tecnológico. La tracción dependerá de la distribución.
3. La competencia real en la calle es el software comercial local (Valery, Saint, a2, Profit Plus, Fina), no Odoo.
4. La parte fiscal está en transición y es el mayor riesgo legal; conviene aislarla en módulos por país.
5. Técnicamente es viable para una persona si la sincronización se diseña como un registro de operaciones
   inmutables, que es justo la forma natural de un punto de venta.

## 2. Qué existe en código abierto

| Proyecto | Licencia / stack | Sin conexión | Dos monedas en caja | Clientes / fiado | Debilidad frente a Ventamas |
|---|---|---|---|---|---|
| [Odoo Community POS](https://github.com/odoo/odoo) | LGPL-3 [NV]; Python, PostgreSQL | Parcial [V]: la sesión debe abrirse en línea; no se puede abrir caja sin internet ([foro](https://www.odoo.com/forum/help-1/whats-the-mechanism-of-pos-offline-283217)) | No nativo [B]; módulos de pago y cerrados, p. ej. [mai_pos_dual_currency](https://apps.odoo.com/apps/modules/18.0/mai_pos_dual_currency) a US$85 [V] | Sí [V] ([doc](https://www.odoo.com/documentation/19.0/applications/sales/point_of_sale/payment_methods/customer_credit.html)) | Complejidad de ERP; la doble moneda venezolana es propietaria |
| [ERPNext POS](https://github.com/frappe/erpnext) | GPL-3; Python, Frappe, MariaDB | No [V] ([foro](https://discuss.frappe.io/t/point-of-sale-pos-customer-cases-pain-points-strengths/121292)) | Señalado como el mayor reto [V] | Vía ERP [I] | Interfaz y falta de offline, según sus usuarios |
| [POS Awesome V15](https://github.com/defendicon/POS-Awesome-V15) | GPL-3; Vue 3 sobre ERPNext | Sí [V], con cola y reintento | **Sí [V]**: pago y vuelto en varias monedas, guarda la tasa | Sí [V] | Exige montar ERPNext completo |
| [POSNext](https://github.com/BrainWise-DEV/POSNext) | AGPL-3; Vue 3, IndexedDB, sobre ERPNext | Sí [V] | Solo formato y tasas [V] | Crédito y pagos parciales [V] | Igual, sin cobro bimoneda |
| [OSPOS](https://github.com/opensourcepos/opensourcepos) | MIT; PHP, MySQL | No documentado [V] | No [V] | Clientes; fiado [NV] | Sin offline; interfaz antigua |
| [NexoPOS](https://github.com/Blair2004/NexoPOS) | GPL-3; Laravel, Vue | No mencionado [V] | No mencionado [V] | Clientes; crédito [NV] | En línea; módulos clave de pago [B] |
| uniCenta / Chromis / Openbravo POS | GPL-3; Java de escritorio | Local, sin nube [I] | [NV] | [NV] | Experiencia y stack de 2010 |
| [Dolibarr TakePOS](https://github.com/Dolibarr/dolibarr) | GPL-3; PHP | No documentado [V] | No documentado [V] | Vía ERP [I] | ERP web; la caja es secundaria |
| [Frappe Books](https://github.com/frappe/books) | AGPL-3; Electron, SQLite | Sí, era local [V] | No [V] | [NV] | Archivado, fin de vida [V, fecha por confirmar] |
| [Store-POS](https://github.com/tngoman/Store-POS) | [NV]; Electron, SQLite | Local con LAN; sin nube [V] | Una moneda [V] | Sin fiado [V] | Sin sincronización ni multimoneda |
| [Lakasir](https://github.com/lakasir/lakasir) | GPL-3; Laravel, Flutter | No mencionado [V] | No mencionado [V] | Cuentas por cobrar [V] | En línea; referencia de simplicidad |
| [Posnic](https://github.com/Posnic/POS) | AGPL-3; Electron, MongoDB | Sí; la sincronización entre cajas es de pago [V] | No [V] | Saldos y abonos [V] | Sincronización cerrada |
| [PuntoVivo](https://github.com/johnny4young/puntovivo) | MIT; Electron, React, Fastify, SQLite | Sí [V]: SQLite local y patrón outbox | No [V] | No documentado [V] | Pre-piloto; centrado en la DIAN de Colombia |
| Loyverse (cerrado) | — | Vende offline, pero sin reembolsos, sin alta de clientes y sin ver stock [V] ([ayuda](https://help.loyverse.com/help/offline-work-of-pos)) | Una moneda por tienda [B] | — | Referencia de simplicidad y lista de lo que superar |

Otros: Akaunting no trabaja sin conexión [V]; InvenTree no tiene caja [B]; el POS de Medusa tiene el modo
offline como "próximamente" [V]; no se encontró POS para Vendure ni Saleor [B].

### Quejas recurrentes sobre Odoo y ERPNext

- **No es para quien empieza.** Merchant Maverick lo lista como "Not for first-time POS users" [V]
  ([reseña](https://www.merchantmaverick.com/reviews/odoo-review/)).
- **Implantaciones que no terminan.** Reseñas en Capterra de 2025-2026: "very very clunky", proyectos sin terminar,
  150 horas de soporte sin resultado [V] ([Capterra](https://www.capterra.com/p/135618/Odoo/reviews/)).
- **Jerga contable.** "way too complicated for someone with a non-accounting background" [V]
  ([Trustpilot](https://nz.trustpilot.com/review/odoo.com?page=7)).
- **Configuración frágil y costo creciente** [V] ([foro Frappe](https://discuss.frappe.io/t/usability-in-comparison-to-odoo-for-retail-pos/110762),
  [Ventor](https://ventor.tech/odoo/why-odoo-works-for-thousands-but-failed-for-you)).
- **ERPNext:** sin offline, monedas mezcladas como el mayor reto, mantenimiento difícil [V]
  ([foro](https://discuss.frappe.io/t/if-you-were-to-abandon-erpnext-what-would-be-the-reason/88513)).

### Proyectos para estudiar de cerca

1. **POS Awesome V15**, por su modelo de datos: moneda y tasa por pago, vuelto por moneda, cola con identidad de
   petición para no duplicar ventas.
2. **PuntoVivo**, por su sincronización: el stack más parecido (TypeScript, SQLite local como fuente de verdad).
3. **Loyverse**, por su simplicidad, y por sus límites sin conexión.

## 3. Venezuela: cómo cobra hoy un comercio pequeño

- **Precios en dólares, pago en bolívares.** 95 % de los precios se fija en USD; en abril de 2025, 53 % de las
  transacciones fue en bolívares y 47 % en divisas [V]
  ([Bloomberg Línea](https://www.bloomberglinea.com/latinoamerica/venezuela-esta-realmente-ante-una-rebolivarizacion-de-su-economia-el-dolar-sigue-fuerte/)).
- **Medios de pago** (Ecoanalítica, fines de 2024): 75,3 % en bolívares, de los cuales 66 % punto de venta bancario,
  28,3 % pago móvil, 3,4 % Biopago y 2,4 % efectivo; en divisas, 16 % dólares y 1,8 % cripto [V]
  ([Finanzas Digital](https://finanzasdigital.com/transacciones-bolivares-supermercados-venezuela-2025/)).
- **Pago mixto.** Varios medios en una sola compra; una caja puede tardar hasta 15 minutos [V]
  ([NTN24](https://www.ntn24.com/noticias-economia/pago-mixto-el-fenomeno-unico-en-venezuela-que-ralentiza-el-proceso-de-pago-407874)).
- **Vuelto.** Faltan billetes de baja denominación; se resuelve con productos, pago móvil o papelitos de deuda
  [V, fuente de 2021] ([VOA](https://www.vozdeamerica.com/a/venezuela_en-venezuela-se-ha-complicado-dar-el-cambio/6072596.html)).
- **Tasa.** El BCV la publica a diario. Oficial 866,56 Bs/USD (2-oct-2026) y paralelo 974,41, una brecha de ~12 %;
  superó 32 % en abril de 2026 [V] ([DolarApi](https://ve.dolarapi.com/v1/dolares),
  [CriptoNoticias](https://www.criptonoticias.com/comunidad/luis-vicente-leon-brecha-cambiaria-bcv-usdt-se-reducira/)).
- **APIs de tasa.** No se encontró API oficial del BCV [NV]. DolarApi es comunitaria y abierta [V]
  ([doc](https://dolarapi.com/docs/venezuela/)). Consecuencia: carga manual siempre disponible y tasa guardada en
  cada venta.
- **IGTF.** 3 % sobre pagos en divisas y cripto; 0 % en bolívares desde julio de 2024. Solo aplica cuando interviene
  un sujeto pasivo especial [V] ([Acceso a la Justicia](https://accesoalajusticia.org/fue-eliminado-impuesto-grandes-transacciones-financieras/)).
  Una bodega que no lo es no lo percibiría [I]: confirmar con contador.
- **IVA.** General 16 %, reducida 8 %; alimentos y medicinas exentos [B].
- **Fiado.** Se lleva en dólares para no perder con la devaluación [B, 2020]. La pyme típica usa cuaderno, Excel
  y WhatsApp [V, dicho por un competidor].

### Obligaciones fiscales (SENIAT)

- **Homologación de software derogada.** La Providencia SNAT/2026/00084 (G.O. 43.435, 12-ago-2026) derogó la
  SNAT/2024/000121 [V, prensa y firma contable]
  ([Forvis Mazars](https://www.forvismazars.com/ve/es/insights/forvis-mazars-insights/fmi-0726-derogatoria-de-sistemas-homologados),
  [El Diario](https://eldiario.com/2026/08/17/cambios-seniat/)).
- **Máquina fiscal.** Uso obligatorio si concurren tres condiciones: ingresos superiores a 1.500 UT, más ventas a
  no contribuyentes que a contribuyentes, y actividad listada [V, sentencia de 2018]
  ([Acceso a la Justicia](https://accesoalajusticia.org/cuando-es-obligatorio-usar-solo-maquinas-fiscales-como-medio-de-facturacion/)).
  Si la norma vigente dice lo mismo y cuánto valen hoy 1.500 UT: [NV].
- **Factura digital** (SNAT/2024/000102): obligatoria desde marzo de 2025 para quien vende solo por medios
  electrónicos; exige imprenta digital autorizada y conectividad [V]
  ([Forvis Mazars](https://www.forvismazars.com/ve/es/insights/forvis-mazars-insights/fmi-0125-facturacion-digital)).
- **Qué puede hacer Ventamas** [I]: operar como sistema administrativo que envía la venta a una impresora fiscal o
  a una imprenta digital, y emitir comprobantes internos rotulados "no fiscal".
- **Requiere contador o abogado:** si la nota de entrega es admisible sin factura, las sanciones del Código
  Orgánico Tributario, y qué exige hoy el régimen general tras la derogatoria.

### Competencia comercial local

| Producto | Lo confirmado | Fuente |
|---|---|---|
| Valery Profesional | US$352,80 + IVA en un distribuidor; multimoneda; hasta 10 usuarios; impresoras fiscales | [PC Shop](https://www.pcshopvzla.com/products/valery-profesional) |
| a2 Softway | Punto de venta, administrativo y apps Android; sin precio público | [a2](https://www.a2.com.ve/) |
| Saint | Varias ediciones y una anual en la nube; sin precio público; más de 450 canales | [Saint](https://saintnet.com/) |
| Fina (nube, móvil) | US$35/mes; bolívares y USD; más de 5.000 comercios; "baja conectividad", no dice offline | [Ecosistema Startup](https://ecosistemastartup.com/fina-levanta-us1m-para-digitalizar-el-comercio-venezolano/) |
| Odoo + módulos venezolanos | Doble moneda por US$130–232; conector de terminal Megasoft por US$3.000 | [Odoo Apps](https://apps.odoo.com/apps/modules/18.0/dps_pos_dual_currency) |
| pos-venezuela (AGPL) | Sobre OpenERP; sin actividad desde 2012 | [Launchpad](https://launchpad.net/pos-venezuela) |

Sin verificar: precio de Profit Plus, Gálac, Premium Soft y Gsoft; si Valery, a2 y Saint funcionan sin conexión;
reseñas de usuarios de cualquiera de ellos.

### Infraestructura

- **Electricidad.** Protestas el 23-sep-2026 por cortes de 12 a 16 horas diarias en cuatro estados [V]
  ([NTN24](https://www.ntn24.com/noticias-actualidad/apagones-horas-desatan-indignacion-protestas-varios-estados-venezuela-653044)).
- **Internet.** 61,6 % de penetración; mediana de 92 Mbps fijo y 25 Mbps móvil [V]
  ([DataReportal](https://datareportal.com/reports/digital-2026-venezuela)).
- **Equipos de los comercios.** Sin datos. PC con Windows antiguas, Android de gama baja, térmicas de 58/80 mm y
  lectores USB [I]: validar en campo.

### Otros países

Argentina (ARCA), Colombia (DIAN, POS electrónico) y México (CFDI 4.0) exigen facturación electrónica con
validación en línea. Conviene un núcleo neutro con módulos fiscales por país, y una cola de contingencia para el
modo sin conexión [I].

## 4. Opciones técnicas

### Datos sin conexión

Ninguna solución lista cumple a la vez: código abierto puro, PostgreSQL propio y escrituras sin conexión durante días.

| Opción | Licencia | Veredicto |
|---|---|---|
| SQLite WASM + OPFS | Apache-2.0 | Solo almacenamiento; la sincronización se construye aparte. **Base recomendada.** |
| PowerSync | SDK Apache-2.0; servicio FSL (no OSI) | Maduro para SQLite↔Postgres. **Alternativa conservadora.** |
| ElectricSQL | Apache-2.0 | Solo sincroniza lecturas |
| Zero / Replicache | Apache-2.0 / gratis | Zero no admite escrituras sin conexión; Replicache en mantenimiento |
| RxDB | Núcleo Apache-2.0 | Los almacenamientos buenos son de pago |
| PouchDB / CouchDB | Apache-2.0 | Patrón probado en cajas, pero obliga a dejar PostgreSQL |
| LiveStore | Apache-2.0 | El modelo ideal (eventos), aún beta |
| Triplit, cr-sqlite | — | Estancados |

**Registro propio de operaciones inmutables** [opinión del investigador]: es lo que mejor encaja.

- Ventas: hechos inmutables con identificador único; subida idempotente.
- Inventario: suma de movimientos, nunca un campo "existencia". Puede quedar negativo y se marca para revisión.
- Correlativos: prefijo por caja más secuencia local (C02-000123).
- Cierre de caja: un evento que referencia un rango de secuencia del dispositivo.
- Reloj: el orden lo da el servidor al recibir; la hora del dispositivo solo se muestra.
- Catálogo y clientes: manda el servidor; el último cambio por campo gana.

### Forma de entrega

- **Aplicación web instalable (PWA) en la nube:** lo más simple de instalar y actualizar. Cada caja vende sin
  conexión, pero las cajas no se ven entre sí sin internet.
- **Servidor local en la tienda:** exige certificados instalados a mano en cada equipo. Mala opción para un usuario
  no técnico.
- **Escritorio (Tauri 2 / Electron):** acceso a puerto serie y archivos. Requisito realista: Windows 10 o superior.
- **Recomendación:** PWA para el MVP; en una segunda fase, aplicación de escritorio en la caja principal como
  puente de periféricos y concentrador local.

### Periféricos

- Impresoras térmicas: WebUSB no funciona en Windows sin cambiar el controlador [V]. Web Serial sí funciona en
  Chrome/Edge de escritorio. Respaldo universal: imprimir a 80 mm con el diálogo del navegador.
- Lector de códigos: en modo teclado funciona en todas partes; por cámara en Android.
- Gaveta: pulso a través de la impresora.
- Impresoras fiscales venezolanas: puerto serie con SDK del fabricante; no son viables desde web pura, requieren
  el puente de escritorio [opinión]. Protocolo público de HKA: [NV].

### Modularidad

Mínimo razonable para una persona: un solo repositorio con módulos como carpetas. Cada módulo declara un manifiesto
(identificador, dependencias, migraciones, rutas, menú, eventos, permisos) y se activa por tienda. Sin carga
dinámica ni tienda de módulos.

### Dinero

- Enteros en unidad mínima más código de moneda; monedas como tabla, por las reconversiones del bolívar.
- Moneda base de reporte separada de la moneda de cada pago.
- Cada venta y cada pago guardan la tasa usada, su fuente y su hora. El pasado nunca se recalcula.
- El vuelto es una línea de pago negativa en cualquier moneda.
- Librerías vigentes: dinero.js 2, big.js, decimal.js.
- **Finanzas futuras:** un plan de cuentas completo es prematuro, pero conviene registrar desde el día uno los
  movimientos de dinero y de existencias como transferencias inmutables (origen, destino, monto, moneda). Así el
  módulo de finanzas será una vista y no una migración.

### Documentación y licencia

- Manuales: Starlight (español como idioma principal) dentro del mismo repositorio. Tours en la aplicación con
  driver.js. Tienda de demostración con datos de ejemplo.
- Licencia sugerida: AGPL-3.0, que impide la reventa cerrada incluso como servicio. MIT maximiza adopción pero
  permite copias cerradas. Complementos: marca "Ventamas" reservada y documentación en CC BY-SA.

### Stack sugerido para el MVP

React + Vite + TypeScript como PWA · SQLite WASM sobre OPFS · registro de operaciones propio · Node + Prisma +
PostgreSQL en Coolify · Starlight + driver.js · AGPL-3.0.

**Riesgos técnicos**

1. Pérdida de datos locales antes de sincronizar. Mitigación: almacenamiento persistente, indicador visible de
   pendientes y exportación automática en cada cierre.
2. Corrección del motor de sincronización propio. Mitigación: operaciones inmutables y versionadas, y pruebas de
   simulación con varias cajas y desconexiones.
3. Variedad de equipos y varias cajas sin internet. Mitigación: lista corta de equipos soportados y concentrador
   local en fase dos.

## 5. Dolores a resolver primero

1. Cobro en dos monedas con tasa diaria: precio en USD, cobro en bolívares, tasa guardada por venta.
2. Pago mixto y vuelto: varios medios por venta, vuelto en otra moneda o como saldo a favor.
3. Cortes de luz e internet: venta sin conexión de verdad, incluido abrir caja.
4. Fiado e inventario en cuaderno: cuentas por cobrar en USD por cliente.
5. Costo y complejidad de lo existente.

## 6. Riesgos del proyecto

1. **Legal:** régimen fiscal en transición; un comprobante no fiscal puede exponer al comercio a sanciones.
2. **Adopción:** dueños habituados al cuaderno, equipos viejos y competidores con red de distribuidores o capital.
3. **Soporte:** un proyecto abierto sin ingresos debe seguir cambios fiscales, depender de una API de tasa no
   oficial y atender a usuarios no técnicos.
