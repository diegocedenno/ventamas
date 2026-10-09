# Ventamas — Documento de requisitos del producto (PRD)

| | |
|---|---|
| **Versión del documento** | 0.2 |
| **Fecha** | 9 de octubre de 2026 (primera versión: 3 de octubre de 2026) |
| **Autor** | Diego Cedeño, con Claude |
| **Estado** | Alcance acordado en entrevista y ampliado en la versión 0.3 (apartado 6.14) |
| **Investigación de base** | [investigacion.md](investigacion.md) |

Las decisiones marcadas **[Acordado]** salieron de la entrevista de alcance. Las marcadas **[Propuesta]** son
recomendaciones de este documento que aún puedes cambiar. Las marcadas **[Supuesto]** se asumieron para poder
avanzar y conviene confirmarlas.

---

## 1. Resumen

Ventamas es un punto de venta con inventario y registro de clientes para comercios minoristas pequeños. Se instala
en la computadora del mostrador, funciona sin internet y cobra en bolívares, dólares y euros con la tasa del día.
Es 100 % código abierto.

La idea central es ofrecer lo que un comercio pequeño necesita de un sistema como Odoo, sin su complejidad: una
venta en una sola pantalla, palabras de tienda en lugar de jerga contable, y ayuda dentro del propio producto.

## 2. Problema

Un comercio pequeño en Venezuela vende con precios en dólares y cobra mayormente en bolívares, a una tasa que
cambia cada día, con varios medios de pago en una misma compra y con cortes frecuentes de luz e internet. Hoy lo
resuelve con cuaderno, Excel y WhatsApp, o con software que no encaja:

- **Los sistemas grandes de código abierto** (Odoo, ERPNext) exigen implantación, usan lenguaje contable y no
  permiten abrir la caja sin internet. El cobro en dos monedas solo existe en módulos de pago y cerrados.
- **El software comercial local** (Valery, Saint, a2, Fina) cuesta entre unos 35 dólares al mes y unos 350 dólares
  por licencia, y es cerrado.
- **Los puntos de venta abiertos y simples** no cobran en dos monedas.

La investigación no encontró ningún proyecto abierto y autónomo que junte venta sin conexión, cobro real en varias
monedas y simplicidad. El detalle y las fuentes están en [investigacion.md](investigacion.md).

## 3. Objetivos y lo que queda fuera

### Objetivos

1. Que el dueño de una tienda de ropa o zapatos instale Ventamas y venda el mismo día, sin ayuda técnica.
2. Que cobrar en dos o tres monedas, con vuelto, sea más rápido que hacerlo con calculadora y cuaderno.
3. Que el dueño sepa en todo momento qué vendió, qué tiene en inventario y quién le debe.
4. Que el mismo núcleo sirva a otros tipos de comercio activando módulos, sin mostrarle a cada uno lo que no usa.
5. Que actualizar nunca rompa los datos ni la configuración de una tienda.
6. Que el proyecto sea útil para la comunidad: código claro, documentación completa y módulos que otros puedan
   aportar.

### Fuera del proyecto

- **Contabilidad formal:** libros, plan de cuentas y reportes para impuestos. **[Acordado]**
- **Versión alojada por el autor:** no habrá servicio en la nube operado por el proyecto. **[Acordado]**
- **Partes de pago o cerradas.** **[Acordado]**
- **Inteligencia artificial.** **[Acordado]**

## 4. Usuarios

| Persona | Quién es | Qué necesita |
|---|---|---|
| **Dueña de la tienda** | Lleva una tienda de ropa o zapatos, sola o con uno a tres vendedores. No es técnica. Hoy usa cuaderno, calculadora y WhatsApp. | Instalar sin ayuda, saber cuánto vendió y cuánto le deben, y confiar en que no perderá sus datos. |
| **Vendedora** | Atiende el mostrador. Puede ser nueva o rotar con frecuencia. | Cobrar rápido sin equivocarse con la tasa ni con el vuelto, y aprender en minutos. |
| **Técnico de confianza** | Familiar o conocido que ayuda con la computadora. | Un instalador simple, respaldos claros y una guía de instalación. |
| **Desarrollador de la comunidad** | Programador que quiere adaptar Ventamas a su país o a otro tipo de comercio. | Código modular, documentación para contribuir y reglas claras de compatibilidad. |

### Tipos de comercio

| Tipo | Estado | Notas |
|---|---|---|
| **Ropa y calzado** | Primera versión, resuelto a fondo **[Acordado]** | Tallas, colores, cambios, apartados. |
| **Otros comercios de mostrador** | Hecho en la 0.3 **[Acordado]** | 25 rubros con sus categorías y variantes: celulares, ferretería, repuestos, abasto, licorería, farmacia, papelería, hogar, mascotas y más. |
| **Servicios** | Hecho en la 0.3 **[Acordado]** | Peluquería, estética, reparaciones, costura, lavandería, copias, taller: sin existencias, con modalidades y precio abierto. |
| **Emprendimiento que vende por WhatsApp** | Posterior **[Acordado]** | Necesita teléfono como equipo principal y catálogo para compartir. |
| **Comida preparada** | Posterior, como módulo propio **[Acordado]** | Pedidos para llevar o en mesa, productos con ingredientes. Hoy puede vender por producto, sin mesas ni recetas. |

Al iniciar por primera vez, Ventamas pregunta qué vende la tienda y carga las categorías que le corresponden.
**[Acordado]** Lo que todavía no cubre: la venta por peso o por metro, que necesitan los abastos, las charcuterías
y parte de las ferreterías ([decisión 0006](decisiones/0006-catalogo-por-rubro.md)).

## 5. Principios del producto

1. **Una venta, una pantalla.** Buscar, agregar, cobrar y entregar el recibo ocurre sin cambiar de pantalla.
2. **Palabras de tienda.** Ninguna pantalla usa términos contables. Se dice "lo que me deben", no "cuentas por
   cobrar".
3. **Sin internet por defecto.** Todo funciona sin conexión. Internet solo mejora dos cosas opcionales: traer la
   tasa y avisar de actualizaciones.
4. **Nada se pierde ni se borra.** Las ventas no se editan ni se eliminan; se anulan o se corrigen con un registro
   nuevo, y queda el rastro de quién lo hizo.
5. **Mostrar solo lo que se usa.** Cada tipo de comercio ve sus módulos; lo demás no aparece.
6. **Aprender dentro del producto.** La ayuda está donde ocurre la duda, no en un documento aparte.
7. **Actualizar no rompe.** Cada versión nueva abre los datos de cualquier versión anterior.

## 6. Alcance de la primera versión (v1.0)

Todo este apartado está **[Acordado]**, salvo donde se indica.

### 6.1 Venta en caja

- **VEN-01** Buscar productos por nombre o código. Acepta lector de códigos de barras en modo teclado.
- **VEN-02** Al elegir un producto con variantes, pedir talla y color mostrando las existencias de cada una.
- **VEN-03** Mostrar el total en la moneda base y su equivalente en las otras monedas a la tasa del día.
- **VEN-04** Cobrar con varios medios de pago en una misma venta, en cualquier combinación de monedas. Tras cada
  pago, mostrar cuánto falta en cada moneda.
- **VEN-05** Calcular el vuelto y permitir entregarlo en cualquier moneda, o dejarlo como saldo a favor del cliente.
- **VEN-06** Medios de pago configurables, cada uno con su moneda: efectivo en bolívares, dólares y euros, punto de
  venta bancario, pago móvil, transferencia, Zelle y otros. Campo opcional para la referencia. **[Propuesta]**
- **VEN-07** Asociar la venta a un cliente, de forma opcional.
- **VEN-08** Al cobrar, descontar existencias, guardar la venta con las tasas usadas y ofrecer el recibo.
- **VEN-09** Vender sin existencias con una advertencia; el producto queda marcado para revisión.
- **VEN-10** Toda la venta se puede completar solo con teclado.

### 6.2 Monedas y tasas

- **MON-01** Tres monedas: bolívar, dólar y euro. La lista de monedas es configurable para otros países.
- **MON-02** Los precios se guardan en la moneda base de la tienda, que se elige al configurar; por defecto, el
  dólar. **[Supuesto]**
- **MON-03** Dos tasas oficiales: BCV del dólar y BCV del euro. Con internet, Ventamas las trae y el dueño las
  confirma. Sin internet, el dueño las escribe a mano.
- **MON-04** Solo el dueño cambia las tasas. Cada cambio queda registrado con fecha y autor.
- **MON-05** Cada venta y cada pago guardan la tasa con la que se cobraron. El historial nunca se recalcula.
- **MON-06** Si la tasa del día no se ha confirmado al abrir la caja, Ventamas lo pide antes de la primera venta.
  **[Propuesta]**
- **MON-07** Si el bolívar cambia de escala (reconversión), el historial se conserva tal como se registró.
- **MON-08** Los precios son finales. La primera versión no desglosa impuestos; eso llega con los módulos fiscales.
  **[Supuesto]**

### 6.3 Productos e inventario

- **INV-01** Productos con nombre, categoría, precio, costo opcional, foto opcional y código.
- **INV-02** Variantes por talla y color, cada una con sus propias existencias y código.
- **INV-03** Entradas de mercancía y ajustes de inventario con motivo (conteo, daño, pérdida).
- **INV-04** Aviso de existencias bajas, con un mínimo configurable por producto.
- **INV-05** Historial de movimientos por producto: qué entró, qué salió y por qué.
- **INV-06** Importar productos desde una hoja de cálculo, para no cargar el catálogo a mano. **[Propuesta]**

### 6.4 Clientes

- **CLI-01** Registro con nombre, teléfono y documento de identidad opcional. Alta rápida desde la pantalla de venta.
- **CLI-02** Historial de compras por cliente.
- **CLI-03** Saldo pendiente y saldo a favor por cliente, en la moneda base.

### 6.5 Apartados y fiado

- **APA-01** Apartado: reservar piezas con un abono inicial y una fecha límite. Las piezas salen del inventario
  disponible.
- **APA-02** Fiado: entregar la mercancía y dejar el saldo pendiente a nombre del cliente.
- **APA-03** Abonos en cualquier moneda, convertidos a la tasa del día del abono.
- **APA-04** Al vencer un apartado, Ventamas avisa. El dueño decide si lo extiende o lo cancela y devuelve las piezas
  al inventario.
- **APA-05** Lista de lo que me deben, ordenada por antigüedad.

### 6.6 Cambios y devoluciones

- **DEV-01** Cambio de una pieza por otra, con cobro o devolución de la diferencia.
- **DEV-02** Devolución con reintegro de dinero o como saldo a favor del cliente.
- **DEV-03** Anulación de una venta completa, con motivo.
- **DEV-04** Las piezas devueltas regresan al inventario, salvo que se marquen como dañadas.

### 6.7 Caja

- **CAJ-01** Apertura con el monto inicial por moneda.
- **CAJ-02** Cierre con conteo por moneda y por medio de pago, comparado con lo esperado. Muestra la diferencia.
- **CAJ-03** Entradas y salidas de efectivo durante el día, con motivo.
- **CAJ-04** Resumen de cierre imprimible.

### 6.8 Reportes básicos

- **REP-01** Ventas del día, por medio de pago y por moneda.
- **REP-02** Productos más vendidos en un periodo.
- **REP-03** Lo que me deben, por cliente.
- **REP-04** Exportar cualquier reporte a hoja de cálculo. **[Propuesta]**

### 6.9 Usuarios y permisos

- **USU-01** Dos roles: dueño y vendedor.
- **USU-02** El vendedor puede vender y registrar clientes, apartados y abonos.
- **USU-03** Anular ventas, hacer devoluciones con reintegro de dinero, cambiar precios, cambiar tasas y ver reportes
  requiere al dueño.
- **USU-04** Cambio rápido de usuario con un PIN, sin cerrar la aplicación. **[Propuesta]**
- **USU-05** Registro de quién hizo cada venta, anulación, ajuste y cambio de tasa.

### 6.10 Configuración inicial y marca

- **CFG-01** Asistente de primer uso: tipo de comercio, datos de la tienda, moneda base, tasas y usuario dueño.
- **CFG-02** Marca: nombre, direcciones, teléfonos, redes sociales y logo. Aparecen en el recibo.
- **CFG-03** Tema de color a elegir entre ocho. Todos cumplen contraste accesible.
- **CFG-04** Activar o desactivar módulos después de la configuración inicial.

### 6.11 Comprobante

- **COM-01** Recibo interno con la marca de la tienda, rotulado como no fiscal.
- **COM-02** Impresión en impresora térmica de 58 u 80 mm instalada en Windows.
- **COM-03** Envío por WhatsApp: Ventamas genera el recibo como imagen o PDF y abre el chat del cliente con un
  mensaje listo. Adjuntar la imagen es un paso manual (pegar o arrastrar), porque WhatsApp no permite adjuntar
  archivos de forma automática desde otra aplicación. **[Propuesta]**
- **COM-04** El manual y el asistente advierten que el recibo no sustituye a la factura. El comercio obligado a
  facturar con máquina fiscal o talonario debe seguir haciéndolo.

### 6.12 Respaldo y restauración

- **RES-01** Respaldo manual a un archivo, con un clic.
- **RES-02** Respaldo automático diario a una carpeta que el dueño elige: un pendrive o una carpeta sincronizada
  con la nube. **[Propuesta]**
- **RES-03** Restaurar desde un archivo de respaldo, incluso en otra computadora.
- **RES-04** Aviso visible cuando han pasado varios días sin respaldo. **[Propuesta]**

### 6.13 Ayuda integrada

- **AYU-01** Guía paso a paso la primera vez que se abre cada pantalla.
- **AYU-02** Tienda de demostración: un modo de práctica con productos y clientes de ejemplo, separado de los datos
  reales.
- **AYU-03** Manual escrito con capturas, organizado por tareas y consultable sin internet desde la aplicación.
- **AYU-04** Sitio web de documentación con el mismo manual, la guía de instalación y la documentación para
  contribuir.
- **AYU-05** El manual de la aplicación y el del sitio web salen del mismo contenido, para que no se desincronicen.

### 6.14 Lo que la versión 0.3 añadió al alcance

Pedido el 8 de octubre de 2026 y construido tras una segunda ronda de investigación
([apartado 7 de la investigación](investigacion.md)). **[Acordado]**

- **CAT-01** Catálogo incluido de tipos de comercio: al elegir uno o varios, se cargan sus categorías, cada una con
  las variantes que suelen tener sus productos y sus valores habituales. Se ajusta después.
- **CAT-02** Variantes con el nombre que haga falta (talla, capacidad, presentación, sabor), hasta dos por
  producto, y precio propio por pieza.
- **SER-01** Servicios: sin existencias, con modalidades (para quién, tipo de vehículo) y, si hace falta, con el
  precio abierto: se escribe al cobrar.
- **VEN-11** Descuento por línea (porcentaje o monto) y descuento a toda la venta.
- **VEN-12** Venta en espera: se guarda a medio armar para atender a otra persona y se retoma después.
- **VEN-13** Productos a la vista, por categoría, para vender con un toque; montos habituales al cobrar en
  efectivo; vuelto propuesto en billetes enteros de la divisa y el resto en bolívares.
- **VEN-14** Historial de ventas por periodo, cliente o número, con su recibo.
- **IMP-01** Impuestos, apagados por defecto: tasas por producto, precios con el impuesto incluido o aparte, y
  desglose por tasa en la venta y en el recibo. Sustituye al supuesto MON-08.
- **FAC-01** Facturación, apagada por defecto, en dos modos: anotar en cada venta la factura emitida por otro
  medio, o imprimirla sobre formas libres de una imprenta autorizada. Con anulación y un auxiliar del libro de
  ventas. Qué hace y qué no, y por qué: [decisión 0008](decisiones/0008-facturacion.md).
- **INV-07** Movimientos de existencias con motivo, historial por producto, existencia mínima con lista por
  reponer, costo promedio al recibir mercancía y códigos propios. Completa INV-03, INV-04 e INV-05.
- **CAJ-05** Corte parcial sin cerrar la caja, conteo por billetes, conteo a ciegas opcional y motivos habituales.

## 7. Fuera de la primera versión

En el orden en que se propone abordarlos después:

1. Venta por peso o por metro (cantidades con decimales).
2. Promociones (dos por uno, precios por temporada). Los descuentos ya existen.
3. Impresión de etiquetas con código de barras.
4. Compras a proveedores y cuentas por pagar.
5. Gastos y finanzas básicas.
6. Teléfono del dueño para consultar ventas e inventario.
7. Varias cajas sincronizadas.
8. Catálogo para compartir por WhatsApp.
9. Comida preparada.
10. Conexión con máquinas fiscales e imprentas digitales venezolanas; después, facturación de otros países.
11. Videos tutoriales.

## 8. Flujo de referencia: la venta ideal

Este flujo es el criterio de aceptación principal de la primera versión. **[Acordado]**

1. Una clienta lleva unos zapatos talla 38 de 45 dólares y una blusa talla M de 20 dólares.
2. La vendedora escribe "zapato" en el buscador, toca el producto y elige talla 38. Repite con la blusa.
3. La pantalla muestra el total: 65 dólares y su equivalente en bolívares a la tasa del día.
4. La clienta paga 40 dólares en efectivo y el resto por pago móvil.
5. La vendedora toca "Dólares efectivo" y escribe 40. Ventamas le dice cuánto falta en bolívares.
6. Toca "Pago móvil", confirma el monto y anota los últimos dígitos de la referencia.
7. Toca "Cobrar".
8. Ventamas descuenta las dos piezas del inventario, guarda la venta con la tasa usada y ofrece imprimir el recibo
   o enviarlo por WhatsApp.

Toda la venta ocurre en una sola pantalla y toma menos de un minuto.

## 9. Criterios de calidad

### Facilidad de uso **[Acordado]**

1. Instalar y hacer la primera venta de prueba en menos de 15 minutos, sin leer el manual.
2. Una vendedora nueva aprende a cobrar en menos de 10 minutos con la guía de la aplicación.
3. Ninguna pantalla usa términos contables.

### Requisitos no funcionales **[Propuesta]**

| Área | Requisito |
|---|---|
| **Sin conexión** | Todas las funciones de la primera versión operan sin internet. |
| **Equipo mínimo** | Windows 10 de 64 bits, 4 GB de memoria, disco mecánico. |
| **Rendimiento** | La búsqueda responde en menos de 200 ms con 5.000 productos. La aplicación abre en menos de 5 segundos. |
| **Integridad** | Un corte de luz en mitad de una venta no corrompe los datos: la venta queda completa o no queda. |
| **Privacidad** | Ningún dato sale de la computadora. Sin telemetría. Las dos únicas conexiones, tasa y aviso de actualización, son opcionales. |
| **Accesibilidad** | Contraste AA en los ocho temas, uso completo con teclado y botones grandes para pantallas táctiles. |
| **Idioma** | Español primero, con todos los textos separados del código para traducirlos después. **[Supuesto]** |

### Compatibilidad hacia atrás **[Acordado]**

- **Datos:** cada versión abre la base de datos de cualquier versión anterior y la migra sola.
- **Respaldo previo:** antes de migrar, Ventamas guarda un respaldo automático.
- **Respaldos:** un archivo de respaldo de cualquier versión anterior se puede restaurar en la actual.
- **Módulos:** la interfaz entre el núcleo y los módulos tiene versión; un cambio incompatible se anuncia con al
  menos una versión de antelación.
- **Versiones:** numeración semántica y un registro de cambios en lenguaje de usuario.
- **Actualizar es opcional:** Ventamas avisa de una versión nueva, pero nunca obliga a instalarla.

## 10. Arquitectura propuesta

Todo este apartado es **[Propuesta]**; es la parte que la entrevista dejó a criterio de este documento.

### Forma del producto

Aplicación de escritorio para Windows con instalador de un clic. Los datos viven en un archivo de base de datos
local en la misma computadora. No hay servidor.

### Tecnología

| Pieza | Elección | Por qué |
|---|---|---|
| Aplicación de escritorio | Electron | Usa Node.js, tu stack habitual, y puede imprimir en silencio en cualquier impresora instalada en Windows. Decidido en la fase 0: [decisión 0001](decisiones/0001-electron-para-el-escritorio.md). |
| Interfaz | React, TypeScript y Vite | Ecosistema amplio y fácil de encontrar colaboradores. |
| Base de datos local | SQLite integrado en Node | Un solo archivo, sin instalación ni módulos que compilar, resistente a cortes de luz y trivial de respaldar: [decisión 0002](decisiones/0002-sqlite-integrado-y-migraciones.md). |
| Acceso a datos | SQL directo por ahora | La elección entre Drizzle, Kysely o seguir con SQL se toma en la fase 1, con consultas reales. |
| Dinero | Enteros en unidad mínima, con un módulo propio | Evita errores de redondeo: [decisión 0003](decisiones/0003-dinero-en-enteros.md). |
| Documentación | Starlight | Español como idioma principal; el mismo contenido alimenta el sitio y la ayuda interna. |
| Guía en la aplicación | driver.js | Licencia MIT y sin dependencias. |
| Instalador y actualizaciones | electron-builder con GitHub Releases | Publicación automática desde el repositorio. |

**Alternativa a Electron: Tauri.** Produce un instalador más pequeño y usa menos memoria, lo que importa en equipos
viejos. A cambio, las partes nativas se escriben en Rust y la impresión silenciosa es más difícil. En la fase 0 no
se llegó a probar, porque el equipo de desarrollo no tiene Rust ni las herramientas de compilación; la decisión se
revisa si un equipo modesto real resulta demasiado lento.

### Modelo de datos

Dos reglas que vienen de la investigación y que hacen posible crecer sin rehacer nada:

1. **Hechos inmutables.** Ventas, pagos, abonos, movimientos de inventario y cambios de tasa se registran como
   hechos que no se editan. Las existencias y los saldos se calculan sumando movimientos; no hay un campo
   "existencia" que se sobrescriba.
2. **Todo movimiento de dinero tiene origen, destino, monto, moneda y tasa.** Con esto el módulo de finanzas será
   una vista sobre datos que ya existen, y la sincronización entre varias cajas podrá añadirse como un intercambio
   de hechos, sin conflictos de edición.

### Módulos

Un solo repositorio. Cada módulo es una carpeta con un manifiesto que declara su identificador, sus dependencias,
sus migraciones, sus pantallas, sus entradas de menú y sus permisos. Los módulos se compilan dentro de la
aplicación y se activan por tienda. No hay carga dinámica ni tienda de módulos en esta etapa.

El detalle está en la [decisión 0004](decisiones/0004-modulos-compilados.md).

Módulos de la primera versión: núcleo (monedas, usuarios, configuración, respaldo), ventas, inventario, variantes,
clientes, apartados y fiado, devoluciones, caja, reportes y ayuda.

Cada tipo de comercio es una lista de módulos activos más unos valores por defecto.

## 11. Plan de crecimiento

Sin fechas, porque no hay fecha fija. **[Acordado]** Cada fase termina en algo que se puede usar.

### Hacia la primera versión

| Fase | Qué se construye | Qué queda usable al terminar |
|---|---|---|
| **0. Cimientos** (hecha) | Repositorio, licencia, decisión de Electron, modelo de datos, sistema de diseño con los ocho temas, e instalador generado automáticamente. | Un instalador que abre una aplicación vacía con la marca. |
| **1. Vender** (hecha) | Productos con tallas y colores, venta con cobro en varias monedas, tasas, recibo, y apertura y cierre de caja. | Una tienda puede vender y cerrar caja. Primera versión de prueba pública. |
| **1.5 Más comercios** (hecha, versión 0.3) | Catálogo por rubro, variantes con nombre, servicios, clientes, descuentos, ventas en espera, impuestos, facturación, historial, asistente inicial, y mejoras de inventario y caja. | Sirve a más tipos de comercio, incluidos los de servicios, y a quien necesita facturar. |
| **2. Clientes y crédito** | Apartados, fiado, abonos, saldo a favor, cambios, devoluciones y anulación de ventas. Los clientes ya existen. | Reemplaza el cuaderno de fiado. |
| **3. Control** | Reportes, usuarios y permisos, respaldo y restauración, importar productos. | El dueño puede dejar la tienda en manos de un vendedor. |
| **4. Primera impresión** | Logo de la tienda, tienda de demostración, guía paso a paso, manual y sitio web. El asistente inicial ya existe. | Versión 1.0. |

### Después de la primera versión

| Etapa | Contenido |
|---|---|
| **1.x Pulido** | Descuentos y promociones, etiquetas con código de barras, y correcciones surgidas de las tiendas piloto. |
| **2.0 Finanzas básicas** | Compras a proveedores, lo que debo, gastos por categoría, saldos por lugar donde está el dinero, y ganancia del mes. |
| **3.0 Más equipos** | Teléfono del dueño en la red de la tienda, y luego varias cajas sincronizadas. |
| **Módulos por tipo de comercio** | Catálogo para WhatsApp y comida preparada. |
| **Módulos fiscales** | Máquinas fiscales e imprentas digitales venezolanas, y luego facturación electrónica de otros países, idealmente aportada por la comunidad de cada país. Las formas libres y el registro de facturas externas ya existen. |

### Finanzas básicas, en lenguaje de dueño **[Acordado]**

| Pregunta del dueño | Lo que hace falta |
|---|---|
| ¿Cuánto gané este mes? | Ventas menos costo de la mercancía menos gastos. |
| ¿En qué se me va el dinero? | Gastos por categoría: alquiler, sueldos, servicios, transporte. |
| ¿Cuánto dinero tengo y dónde? | Saldos por caja, banco, pago móvil y efectivo en cada moneda. |
| ¿Cuánto me deben y cuánto debo? | Lo que deben los clientes y lo que se debe a proveedores. |
| ¿Qué compré y a qué costo? | Pedidos a proveedores, costo de cada entrada y deuda con cada uno. |

## 12. Código abierto y comunidad

- **Licencia:** AGPL-3.0 para el código. **[Acordado]**
- **Marca:** el nombre "Ventamas" y el logo quedan reservados; las copias modificadas deben usar otro nombre.
  **[Acordado]**
- **Documentación:** licencia Creative Commons BY-SA. **[Propuesta]**
- **Repositorio:** `diegocedenno/ventamas` en GitHub. **[Supuesto]**
- **Para contribuir:** guía de contribución, código de conducta, plantillas de incidencias y una lista de tareas
  aptas para quien llega por primera vez. **[Propuesta]**
- **Aportes esperados de la comunidad:** traducciones, módulos fiscales por país, tipos de comercio nuevos y
  soporte de impresoras.

## 13. Riesgos

| Riesgo | Por qué importa | Cómo se reduce |
|---|---|---|
| **Legal: el recibo no es una factura** | Un comercio obligado a facturar que solo entregue el recibo puede ser sancionado con clausura y multa. El régimen del SENIAT está en transición. | Rótulo claro en el recibo. La facturación explica en pantalla quién está obligado a máquina fiscal, y ofrece anotar en cada venta la factura emitida por otro medio. El dueño del proyecto acepta este riesgo. **[Acordado]** |
| **Legal: facturar en forma libre sin poder** | Una tienda de ropa, de comida o de belleza que facture en formas libres estando obligada a máquina fiscal incumple igual. | El modo viene apagado, y antes de usarlo la pantalla enumera las tres condiciones de la obligación. Las normas se leyeron en transcripciones, no en Gaceta: hace falta un contador. |
| **Catálogo sin validar** | Los rubros, categorías, tallas y medidas se escribieron a partir de menús de tiendas y de conocimiento general, no con comerciantes. | Todo se edita en Ajustes; el archivo del catálogo es fácil de corregir y sus reglas tienen pruebas. |
| **Pérdida de datos** | Todo vive en una sola computadora; un disco dañado borra la tienda. | Respaldo automático diario, aviso cuando falta respaldo, y restauración probada en cada versión. |
| **Sin tienda piloto** | El proyecto no tendrá comercio piloto; las decisiones de facilidad de uso se validan con las metas del apartado 9 y con lo que reporte la comunidad. **[Acordado]** | Tienda de demostración, pruebas automáticas del flujo de venta y un canal para reportes de usuarios. |
| **Alcance grande para una persona** | Once áreas en la primera versión. | Fases que terminan en algo usable; publicar versiones de prueba desde la fase 1. |
| **Aviso de Windows al instalar** | Un instalador sin firma digital muestra una advertencia de "editor desconocido" que asusta a un usuario no técnico. | Explicarlo en la guía de instalación; evaluar el costo de un certificado de firma. |
| **Fuente de las tasas** | No se encontró una API oficial del BCV; las que existen son comunitarias y pueden fallar. | La carga manual siempre está disponible y la tasa automática requiere confirmación del dueño. |
| **Soporte** | Un proyecto abierto sin ingresos recibe peticiones de usuarios no técnicos. | Manual por tareas, tienda de demostración, y un canal único de ayuda. |
| **Competidores con distribuidores** | Saint declara más de 450 canales; Fina tiene capital. | La licencia AGPL impide la reventa cerrada; la ventaja de Ventamas es ser gratis, abierto y sin conexión. |

## 14. Puntos abiertos

1. **Moneda base.** Resuelto en la 0.3: cada tienda la elige en el asistente inicial, con el dólar por defecto, y
   no se cambia después.
2. **Impuestos.** Resuelto en la 0.3: apagados por defecto; quien los activa elige si sus precios los incluyen.
3. **Fuente de la tasa BCV del euro.** Resuelto en la 0.2: el mismo servicio comunitario la ofrece.
4. **Firma digital del instalador.** Pendiente de decidir según el costo.
5. **Datos de la investigación por confirmar.** Varias normas y cifras de 2026 vienen de prensa y no de fuente
   primaria; están marcadas en [investigacion.md](investigacion.md).

Cerrados el 3 de octubre de 2026 por decisión del dueño del proyecto: el nombre "Ventamas" se mantiene sin más
comprobación; el recibo no fiscal no requiere validación previa; no habrá tienda piloto.

## 15. Siguiente paso

Las fases 0, 1 y 1.5 están hechas (versión 0.3); sigue la fase 2 (crédito, devoluciones y anulaciones). Las
decisiones técnicas quedan registradas en [decisiones/](decisiones/).

### Lo que queda pendiente de lo ya empezado

| Requisito | Qué falta | Cuándo |
|---|---|---|
| VEN-05 | Dejar el vuelto como saldo a favor del cliente. Hoy el vuelto se entrega completo, en una o varias monedas. | Fase 2. |
| CLI-03 | Saldo pendiente y saldo a favor por cliente. Hoy el cliente tiene su ficha y sus compras. | Fase 2. |
| MON-04, USU | Que solo el dueño cambie tasas, dé descuentos o anule facturas. Hoy no hay usuarios: cualquiera puede. | Fase 3. |
| CAJ-05 | El conteo a ciegas oculta lo esperado al cerrar, pero la pantalla de Caja lo sigue mostrando. | Fase 3, con los permisos. |
| COM-03 | Enviar el recibo por WhatsApp. Hoy se puede guardar como PDF y adjuntarlo a mano. | Fase 2. |
| INV-01, CFG-02 | Foto del producto y logo de la tienda. | Fases 3 y 4. |
| INV-06 | Importar productos desde una hoja de cálculo. | Fase 3. |
| FAC-01 | Notas de crédito y de débito; conexión con máquinas fiscales e imprentas digitales. | Con las devoluciones, y después. |
| CAT-02 | Venta por peso o por metro. | Antes de servir bien a abastos y ferreterías. |
| — | Anular una venta hecha por error. | Fase 2, con las devoluciones. |

### Pendiente de comprobar con equipos reales

- La aplicación en un equipo modesto (Windows 10, 4 GB de memoria, disco mecánico).
- La impresión del recibo en una impresora térmica de 58 y de 80 mm. El recibo se revisó como PDF.
- La impresión de una factura sobre una forma libre real: el espacio del encabezado y los márgenes se ajustan en
  Ajustes, pero solo se revisó como PDF en tamaño carta.
- Un lector de códigos de barras real. Se probó tecleando el código y pulsando Enter, que es lo que hace un lector.
