// Prueba de extremo a extremo: abre la aplicación de verdad y la usa como una tienda.
// Uso: npm run build && npm run e2e            (prueba el código compilado en out/)
//      npm run e2e -- --packaged                (prueba dist/win-unpacked/Ventamas.exe)
//
// Recorre un día completo: el asistente de bienvenida, confirmar la tasa, abrir la caja,
// crear productos y servicios desde las categorías de su rubro, registrar un cliente,
// vender (con ratón, con teclado y con código de barras; con descuentos, en espera, con
// impuestos y con vuelto repartido), facturar, revisar el inventario y cerrar la caja.
// Trabaja en una carpeta de datos temporal (.e2e/datos), nunca en la tienda real, y deja
// capturas en .e2e/capturas para revisarlas a ojo.
import { _electron as electron } from "playwright";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packaged = process.argv.includes("--packaged");
const dataDir = join(root, ".e2e", "datos");
const shots = join(root, ".e2e", "capturas");

rmSync(dataDir, { recursive: true, force: true });
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });

const problems = [];
let checks = 0;
let step = "";

function assert(condition, message) {
  checks++;
  if (!condition) throw new Error(`Aserción fallida (${step}): ${message}`);
}

async function eq(actual, expected, message) {
  const value = await actual;
  assert(value === expected, `${message}: se esperaba «${expected}» y es «${value}»`);
}

async function launch() {
  const options = packaged
    ? { executablePath: join(root, "dist", "win-unpacked", "Ventamas.exe"), args: [] }
    : { args: [root] };
  const app = await electron.launch({ ...options, env: { ...process.env, VENTAMAS_DATA_DIR: dataDir } });
  const page = await app.firstWindow();
  page.on("console", (msg) => {
    if (msg.type() === "error" || msg.type() === "warning") problems.push(`[${msg.type()}] ${msg.text()}`);
  });
  page.on("pageerror", (error) => problems.push(`[excepción] ${error.message}`));
  // Una tienda nueva abre en el asistente; una ya configurada, en la aplicación.
  await page.waitForSelector(".shell, .welcome");
  await page.evaluate(() => document.fonts.ready);
  // La ventana se muestra cuando la interfaz está lista; hasta entonces no se captura nada.
  const window = await app.browserWindow(page);
  for (let i = 0; i < 50 && !(await window.evaluate((w) => w.isVisible())); i++) await page.waitForTimeout(100);
  await page.waitForTimeout(200);
  return { app, page };
}

const shot = (page, name) => page.screenshot({ path: join(shots, `${name}.png`) });
const text = (locator) => locator.textContent().then((value) => (value ?? "").replace(/\s+/g, " ").trim());
const nav = (page, name) => page.getByRole("navigation").getByRole("button", { name, exact: true }).click();
const focused = (page) => page.evaluate(() => document.activeElement?.textContent?.replace(/\s+/g, " ").trim() ?? "");
const option = (scope, label) => scope.locator(".segmented-option", { hasText: label }).click();
const tab = (scope, name) => scope.getByRole("tab", { name, exact: true }).click();

/** Espera a que el foco llegue al control con ese texto (el foco se mueve un instante después de la acción). */
async function focusIs(page, expected, message) {
  try {
    await page.waitForFunction((t) => (document.activeElement?.textContent ?? "").replace(/\s+/g, " ").trim() === t, expected, { timeout: 3000 });
    checks++;
  } catch {
    assert(false, `${message}: el foco debía estar en «${expected}» y está en «${(await focused(page)).slice(0, 60)}»`);
  }
}

/** Espera a que algo se vea; si no aparece, falla con el mensaje. */
async function visible(locator, message) {
  try {
    await locator.waitFor({ state: "visible", timeout: 3000 });
    checks++;
  } catch {
    assert(false, message);
  }
}

/** Espera a que un texto llegue a valer lo esperado (las cifras se recalculan un instante después). */
async function becomes(locator, expected, message) {
  const limit = Date.now() + 3000;
  let value = "";
  while (Date.now() < limit) {
    value = await text(locator).catch(() => "");
    if (value === expected) {
      checks++;
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert(false, `${message}: se esperaba «${expected}» y es «${value}»`);
}

/** Espera a que el foco esté en ese control. */
async function hasFocus(locator, message) {
  try {
    await locator.evaluate(
      (el) =>
        new Promise((resolve, reject) => {
          const limit = Date.now() + 3000;
          (function check() {
            if (el === document.activeElement) resolve(true);
            else if (Date.now() > limit) reject(new Error("sin foco"));
            else setTimeout(check, 20);
          })();
        })
    );
    checks++;
  } catch {
    assert(false, message);
  }
}

/** Busca un producto y lo añade a la venta, eligiendo la pieza si hace falta. */
async function addToSale(page, query, piece) {
  const search = page.getByRole("combobox", { name: "Buscar producto" });
  await search.fill(query);
  await page.getByRole("option").first().waitFor();
  await search.press("Enter");
  if (piece) await page.getByRole("dialog").getByRole("button", { name: piece }).click();
}

const started = Date.now();

try {
  /* ---------- 1 · Primera apertura: el asistente de bienvenida ---------- */
  step = "asistente de bienvenida";
  let { app, page } = await launch();

  await eq(app.evaluate(({ app }) => app.getName()), "Ventamas", "nombre de la aplicación");
  await eq(page.title(), "Ventamas", "título de la ventana");
  assert(existsSync(join(dataDir, "ventamas.db")), "la base de datos se crea en la carpeta de datos");
  assert(await page.evaluate(() => document.fonts.check('16px "Inter"')), "la fuente incluida carga sin internet");
  assert(
    await page.evaluate(() => typeof window.require === "undefined" && typeof window.process === "undefined"),
    "la interfaz no tiene acceso a Node"
  );

  await visible(page.getByRole("heading", { name: "¿Cómo se llama tu tienda?" }), "una tienda nueva abre en el asistente");
  await eq(page.locator(".shell").count(), 0, "el asistente va antes que la aplicación");
  await hasFocus(page.getByLabel("Nombre de la tienda"), "el asistente abre con el foco en el nombre");
  await shot(page, "01-bienvenida");
  // El nombre se deja para después: no es obligatorio.
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("heading", { name: "¿Qué vende tu tienda?" }).waitFor();
  await page.locator("label.rubro", { hasText: "Zapatería y carteras" }).click();
  await page.locator("label.rubro", { hasText: "Peluquería y barbería" }).click();
  await page.locator(".welcome").evaluate((el) => el.scrollTo(0, 0));
  await shot(page, "02-bienvenida-rubros");
  await page.getByRole("button", { name: "Continuar" }).click();

  await page.getByRole("heading", { name: "¿En qué moneda están tus precios?" }).waitFor();
  assert(await page.getByRole("radio", { name: /Dólares/ }).isChecked(), "la moneda propuesta es el dólar");
  await page.getByRole("button", { name: "Atrás" }).click();
  await page.getByRole("heading", { name: "¿Qué vende tu tienda?" }).waitFor();
  assert(await page.locator("label.rubro", { hasText: "Zapatería y carteras" }).locator("input").isChecked(), "al volver atrás, lo elegido sigue marcado");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("heading", { name: "¿En qué moneda están tus precios?" }).waitFor();
  await shot(page, "03-bienvenida-moneda");
  await page.getByRole("button", { name: "Empezar a vender" }).click();

  await page.waitForSelector(".shell");
  await eq(text(page.locator(".brand-store")), "Tu tienda", "tienda sin nombre");
  const menu = await page.getByRole("navigation").getByRole("button").allTextContents();
  assert(menu.join(",") === "Vender,Ventas,Productos,Clientes,Caja,Tasas", `menú en orden (es ${menu.join(",")})`);

  /* ---------- 2 · La tasa de hoy ---------- */
  step = "tasa del día";
  await page.getByRole("heading", { name: "Confirma la tasa de hoy" }).waitFor();
  await shot(page, "04-tasa-pendiente");
  await page.getByRole("button", { name: "Confirmar tasas de hoy" }).click();
  await visible(page.getByText("Escribe la tasa como un número").first(), "sin tasas escritas, avisa junto al campo");
  await page.getByLabel("Bolívares por dólar").fill("866,56");
  await page.getByLabel("Bolívares por euro").fill("973.93");
  await page.getByRole("button", { name: "Confirmar tasas de hoy" }).click();

  /* ---------- 3 · Abrir la caja ---------- */
  step = "abrir caja";
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByRole("heading", { name: "Caja", level: 1 }).waitFor();
  await page.getByLabel("Dólares efectivo").fill("20");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByText("Abierta desde").waitFor();

  /* ---------- 4 · Productos y servicios, desde las categorías del rubro ---------- */
  step = "productos";
  await nav(page, "Productos");
  await page.getByRole("heading", { name: "Todavía no hay productos" }).waitFor();
  await page.getByRole("button", { name: "Nuevo producto" }).first().click();
  const editor = page.getByRole("dialog");
  await focusIs(page, "", "el editor abre con el foco en el nombre");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await visible(editor.getByText("Escribe el nombre."), "sin nombre, avisa junto al campo");

  await editor.getByLabel("Nombre").fill("Zapato deportivo");
  // La categoría viene del rubro elegido y trae sus variantes: talla y color.
  await editor.getByLabel("Categoría").fill("Zapatos deportivos");
  await eq(editor.getByLabel("Primera variante", { exact: true }).inputValue(), "Talla", "la categoría propone su primera variante");
  await eq(editor.getByLabel("Segunda variante (opcional)").inputValue(), "Color", "y la segunda");
  const sizes = editor.getByRole("group", { name: "Habituales: Talla" });
  const colors = editor.getByRole("group", { name: "Habituales: Color" });
  await sizes.getByRole("button", { name: "37", exact: true }).click();
  await sizes.getByRole("button", { name: "38", exact: true }).click();
  await colors.getByRole("button", { name: "Negro", exact: true }).click();
  await colors.getByRole("button", { name: "Blanco", exact: true }).click();
  await eq(editor.getByLabel("Valores de la primera variante").inputValue(), "37, 38", "los valores tocados quedan escritos");
  await eq(editor.locator(".pieces tbody tr").count(), 4, "dos tallas por dos colores dan cuatro piezas");
  await shot(page, "05a-editor-variantes");

  await editor.getByLabel("Precio de venta").fill("45");
  await editor.getByLabel("Costo (opcional)").fill("28,50");
  await visible(editor.getByText("Ganas $ 16,50 en cada venta · margen del 36,7 %"), "con precio y costo, dice cuánto se gana");
  await editor.getByRole("button", { name: "Quitar 37 Blanco" }).click();
  await eq(editor.locator(".pieces tbody tr").count(), 3, "una combinación quitada desaparece");
  await editor.getByLabel("Existencias 37 Negro").fill("2");
  await editor.getByLabel("Existencias 38 Negro").fill("3");
  await editor.getByLabel("Existencias 38 Blanco").fill("1");
  await editor.getByLabel("Código 38 Negro").fill("7591234000018");
  await editor.getByRole("button", { name: "Generar los códigos que faltan" }).click();
  await page.waitForFunction(() => document.querySelector('[aria-label="Código 37 Negro"]')?.value.length === 13);
  assert(/^20\d{11}$/.test(await editor.getByLabel("Código 37 Negro").inputValue()), "los códigos propios empiezan por 20 y tienen 13 cifras");
  await eq(editor.getByLabel("Código 38 Negro").inputValue(), "7591234000018", "un código ya escrito no se pisa");
  await editor.getByLabel("Avisar cuando queden").fill("1");
  await shot(page, "05-editor-producto");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await editor.waitFor({ state: "detached" });

  // Una categoría que no está en el catálogo: las variantes se escriben a mano.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await editor.getByLabel("Nombre").fill("Blusa manga larga");
  await editor.getByLabel("Categoría").fill("Ropa de dama");
  await editor.getByLabel("Precio de venta").fill("20");
  await editor.getByLabel("Se vende en varias tallas, colores o presentaciones").check();
  await editor.getByLabel("Valores de la primera variante").fill("S, M");
  await editor.getByLabel("Existencias M").fill("1");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await visible(editor.getByText("Ponle nombre a esta variante."), "una variante con valores necesita nombre");
  await editor.getByLabel("Primera variante", { exact: true }).fill("Talla");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await editor.waitFor({ state: "detached" });

  // Un servicio con modalidades, cada una con su precio.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await editor.getByLabel("Nombre").fill("Corte de cabello");
  await editor.getByLabel("Categoría").fill("Cortes de cabello");
  assert(await editor.getByRole("radio", { name: "Servicio" }).isChecked(), "una categoría de servicios lo vuelve servicio");
  await eq(editor.getByLabel("Primera variante", { exact: true }).inputValue(), "Para", "el servicio trae sus modalidades");
  const who = editor.getByRole("group", { name: "Habituales: Para" });
  await who.getByRole("button", { name: "Caballero", exact: true }).click();
  await who.getByRole("button", { name: "Dama", exact: true }).click();
  await editor.getByLabel("Precio de venta").fill("8");
  await editor.getByLabel("Cada una tiene su precio").check();
  await editor.getByLabel("Precio Dama").fill("12");
  await eq(editor.getByLabel("Existencias Dama").count(), 0, "un servicio no pide existencias");
  await shot(page, "06-editor-servicio");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await editor.waitFor({ state: "detached" });

  // Un servicio de precio abierto: se escribe al cobrar.
  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await option(editor, "Servicio");
  await editor.getByLabel("Nombre").fill("Arreglo a medida");
  await editor.getByLabel(/El precio se escribe al cobrar/).check();
  await editor.getByRole("button", { name: "Guardar" }).click();
  await editor.waitFor({ state: "detached" });

  const rowOf = (name) => page.locator("tbody tr", { hasText: name });
  await rowOf("Blusa manga larga").waitFor();
  await eq(page.locator("tbody tr").count(), 4, "la lista muestra los cuatro");
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(1)), "$ 45,00", "precio del zapato");
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(3).locator(".num")), "6", "existencias totales del zapato");
  assert((await text(rowOf("Zapato deportivo"))).includes("Por reponer"), "una pieza en su mínimo ya pide reposición");
  await eq(text(rowOf("Corte de cabello").locator("td").nth(1)), "desde $ 8,00", "un servicio con varios precios dice desde cuánto");
  await eq(text(rowOf("Arreglo a medida").locator("td").nth(1)), "Al cobrar", "un precio abierto lo dice");
  assert((await text(rowOf("Corte de cabello"))).includes("Servicio"), "los servicios van marcados");

  // Al reabrir el producto, la combinación quitada sigue quitada.
  await rowOf("Zapato deportivo").getByRole("button", { name: "Zapato deportivo", exact: true }).click();
  await editor.getByRole("heading", { name: "Editar producto" }).waitFor();
  await eq(editor.locator(".pieces tbody tr").count(), 3, "el producto reabre con sus tres piezas");
  await eq(editor.getByLabel("Costo (opcional)").inputValue(), "28,50", "el costo se conserva");
  await eq(editor.getByLabel("Avisar cuando queden").inputValue(), "1", "el mínimo se conserva");
  await editor.getByRole("button", { name: "Cancelar" }).click();

  // Llega mercancía: se registra con su motivo y queda en el historial.
  await page.getByRole("button", { name: "Existencias de Blusa manga larga" }).click();
  const stockDialog = page.getByRole("dialog");
  await stockDialog.getByLabel("Pieza", { exact: true }).selectOption({ label: "S (hay 0)" });
  await stockDialog.getByLabel("Piezas que llegaron").fill("2");
  await stockDialog.getByLabel("Nota (opcional)").fill("Pedido de octubre");
  await stockDialog.getByRole("button", { name: "Registrar" }).click();
  await visible(stockDialog.getByText("Registrado. Ahora hay 2 de S."), "la entrada confirma lo que quedó");
  await tab(stockDialog, "Historial");
  await stockDialog.locator("tbody tr").first().waitFor();
  assert((await text(stockDialog.locator("tbody tr").first())).includes("Llegó mercancía"), "el historial muestra la entrada");
  assert((await text(stockDialog.locator("tbody tr").first())).includes("Pedido de octubre"), "con su nota");
  await shot(page, "07-existencias-historial");
  await stockDialog.getByRole("button", { name: "Cerrar" }).last().click();
  await stockDialog.waitFor({ state: "detached" });

  await page.getByPlaceholder("Buscar por nombre o categoría").fill("dama");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
  await page.getByPlaceholder("Buscar por nombre o categoría").fill("");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 4);
  await option(page, "Servicios");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2);
  await option(page, "Todo");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 4);
  await shot(page, "08-productos");

  /* ---------- 5 · Clientes ---------- */
  step = "clientes";
  await nav(page, "Clientes");
  await page.getByRole("heading", { name: "Todavía no hay clientes" }).waitFor();
  await page.getByRole("button", { name: "Nuevo cliente" }).first().click();
  const customerForm = page.getByRole("dialog");
  await customerForm.getByRole("button", { name: "Guardar" }).click();
  await visible(customerForm.getByText("Escribe el nombre del cliente."), "un cliente necesita nombre");
  await customerForm.getByLabel("Nombre o razón social").fill("María Pérez");
  await customerForm.getByLabel("Cédula o RIF (opcional)").fill("v12345678");
  await customerForm.getByLabel("Teléfono (opcional)").fill("0414-555.12.34");
  await eq(customerForm.getByLabel("Cédula o RIF (opcional)").inputValue(), "V-12345678", "la cédula toma su formato al salir del campo");
  await customerForm.getByRole("button", { name: "Guardar" }).click();
  await customerForm.waitFor({ state: "detached" });
  await rowOf("María Pérez").waitFor();
  await page.getByPlaceholder("Buscar por nombre, cédula o teléfono").fill("04145551234");
  await page.waitForTimeout(300);
  await eq(page.locator("tbody tr").count(), 1, "el cliente se encuentra por su teléfono, escrito de otra forma");
  await shot(page, "09-clientes");

  /* ---------- 6 · La venta de referencia del PRD, con el ratón y con cliente ---------- */
  step = "venta de referencia";
  await nav(page, "Vender");
  const search = page.getByRole("combobox", { name: "Buscar producto" });
  await search.waitFor();
  await hasFocus(search, "la pantalla de venta abre con el foco en el buscador");
  const charge = page.getByRole("button", { name: /^Cobrar/ });
  assert(await charge.isDisabled(), "sin productos no se puede cobrar");
  await visible(page.locator(".tile", { hasText: "Zapato deportivo" }), "los productos están a la vista para venderlos con un toque");
  await shot(page, "10-vender-vacio");

  await addToSale(page, "zapato", "38 · Negro");
  await addToSale(page, "blusa", "M Hay 1");
  await eq(text(page.getByTestId("total")), "$ 65,00", "total de la venta");
  await eq(text(page.getByTestId("total-equivalents")), "Bs 56.326,40 · € 57,83", "total en las otras monedas");
  assert(await charge.isDisabled(), "sin pagos no se puede cobrar");

  await page.getByRole("button", { name: "Poner cliente" }).click();
  const customerPicker = page.getByRole("dialog");
  await customerPicker.getByRole("combobox", { name: "Buscar cliente" }).fill("maria");
  await customerPicker.getByRole("option", { name: /María Pérez/ }).click();
  await customerPicker.waitFor({ state: "detached" });
  await visible(page.locator(".pos-customer", { hasText: "María Pérez" }), "la venta lleva su cliente");

  await page.getByRole("button", { name: "Dólares efectivo" }).click();
  const amount = page.getByTestId("entry-amount");
  await eq(amount.inputValue(), "65,00", "el monto propuesto es lo que falta");
  const quick = page.getByRole("group", { name: "Montos habituales" });
  await eq(quick.getByRole("button").allTextContents().then((list) => list.join(" | ")), "Exacto | $ 70,00 | $ 80,00 | $ 100,00", "billetes sugeridos");
  await amount.fill("40");
  await amount.press("Enter");
  await eq(text(page.getByTestId("due")), "$ 25,00", "tras pagar 40 $, falta");
  await eq(text(page.getByTestId("due-equivalents")), "Bs 21.664,00 · € 22,24", "lo que falta en las otras monedas");
  await shot(page, "11-venta-a-medio-cobrar");

  await page.getByRole("button", { name: "Pago móvil" }).click();
  await eq(amount.inputValue(), "21664,00", "el resto se propone en bolívares");
  await page.getByLabel("Referencia (opcional)").fill("4821");
  await page.getByRole("button", { name: "Agregar" }).click();
  await focusIs(page, "Cobrar $ 65,00", "con la cuenta saldada, el foco pasa a Cobrar");
  await shot(page, "12-venta-lista");
  await charge.click();

  const done = page.getByRole("dialog");
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  assert((await text(done)).includes("C01-000001"), "la primera venta es la C01-000001");
  assert((await text(done)).includes("Cliente: María Pérez"), "la venta registrada muestra su cliente");
  await focusIs(page, "Nueva venta", "el foco queda en Nueva venta");
  await shot(page, "13-venta-registrada");
  await done.getByRole("button", { name: "Guardar PDF" }).click();
  await done.getByText("Guardado en").waitFor();
  const receipt = join(dataDir, "recibos", "C01-000001.pdf");
  assert(existsSync(receipt) && statSync(receipt).size > 2000, "el recibo se guarda como PDF");
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });
  await hasFocus(search, "tras la venta, el foco vuelve al buscador");
  await eq(text(page.getByTestId("total")), "$ 0,00", "la pantalla queda lista para otra venta");
  await eq(page.locator(".pos-customer", { hasText: "María Pérez" }).count(), 0, "y sin el cliente de la anterior");

  /* ---------- 7 · Venta solo con teclado, código de barras y vuelto ---------- */
  step = "venta con teclado";
  await page.keyboard.type("7591234000018");
  await page.keyboard.press("Enter");
  await page.locator(".cart tbody tr").first().waitFor();
  await eq(text(page.locator(".cart-name")), "Zapato deportivo · 38 · Negro", "el código de barras añade la pieza exacta");
  await page.keyboard.press("F4");
  await focusIs(page, "Bolívares efectivo", "F4 lleva al primer medio de pago");
  await page.keyboard.press("Enter");
  await eq(amount.inputValue(), "38995,20", "45 $ en bolívares");
  await page.keyboard.type("40000");
  await page.keyboard.press("Enter");
  await eq(text(page.getByTestId("change")), "Bs 1.004,80", "el vuelto se propone en el mismo efectivo");
  await focusIs(page, "Cobrar $ 45,00", "con vuelto asignado, el foco pasa a Cobrar");
  await shot(page, "14-venta-con-vuelto");
  await page.keyboard.press("Enter");
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  assert((await text(done)).includes("Bs 1.004,80"), "la venta registrada muestra el vuelto");
  await page.keyboard.press("Enter");
  await done.waitFor({ state: "detached" });

  // Un código que no existe queda avisado, sin desaparecer.
  await hasFocus(search, "tras la venta con teclado, el foco vuelve al buscador");
  await page.keyboard.type("0000000000000");
  await page.keyboard.press("Enter");
  await visible(page.getByText("Ningún producto coincide con «0000000000000»."), "un código desconocido se avisa y no se borra solo");
  await page.keyboard.press("Escape");

  /* ---------- 8 · Venta en espera, servicios, precio abierto y descuentos ---------- */
  step = "espera, servicios y descuentos";
  await search.fill("blusa");
  await page.getByRole("option").first().waitFor();
  await search.press("Enter");
  await visible(page.getByRole("dialog").getByRole("button", { name: "M Sin existencias" }), "la pieza agotada lo dice");
  await page.getByRole("dialog").getByRole("button", { name: "M Sin existencias" }).click();
  await visible(page.locator(".cart .badge--warn", { hasText: "Sin existencias" }), "la venta avisa de la pieza agotada");

  // La clienta sigue mirando: su venta queda en espera y se atiende a otra persona.
  await page.getByRole("button", { name: "Dejar en espera" }).click();
  const parkDialog = page.getByRole("dialog");
  await parkDialog.getByLabel("Nombre para reconocerla (opcional)").fill("Señora de la blusa");
  await parkDialog.getByRole("button", { name: "Dejar en espera" }).click();
  await parkDialog.waitFor({ state: "detached" });
  await eq(page.locator(".cart tbody tr").count(), 0, "la venta en espera sale de la pantalla");
  await visible(page.getByRole("button", { name: "En espera (1)" }), "y queda a un toque");

  // Un servicio con modalidades, desde los mosaicos.
  await page.locator(".tile", { hasText: "Corte de cabello" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Dama $ 12,00" }).click();
  await eq(text(page.locator(".cart-name")), "Corte de cabello · Dama", "el servicio entra con su modalidad");
  await eq(page.locator(".cart .badge--warn").count(), 0, "un servicio no avisa de existencias");

  // Un servicio de precio abierto pide el precio al añadirlo.
  await page.locator(".tile", { hasText: "Arreglo a medida" }).click();
  const priceDialog = page.getByRole("dialog");
  await priceDialog.getByRole("button", { name: "Añadir a la venta" }).click();
  await visible(priceDialog.getByText("Escribe el precio como un número mayor que cero."), "sin precio no entra");
  await priceDialog.getByLabel("Precio").fill("5");
  await priceDialog.getByLabel("Precio").press("Enter");
  await priceDialog.waitFor({ state: "detached" });
  await eq(text(page.getByTestId("total")), "$ 17,00", "corte de dama más arreglo");

  // Descuento en una línea: la mitad del corte.
  await page.getByRole("button", { name: "Precio y descuento de Corte de cabello · Dama" }).click();
  const lineDialog = page.getByRole("dialog");
  await lineDialog.getByLabel("Porcentaje de descuento").fill("50");
  await visible(lineDialog.getByText("La línea queda en $ 6,00"), "el descuento se ve antes de aplicarlo");
  await lineDialog.getByRole("button", { name: "Aplicar" }).click();
  await lineDialog.waitFor({ state: "detached" });
  await visible(page.locator(".cart .badge--accent", { hasText: "Descuento −$ 6,00" }), "la línea muestra su descuento");
  await eq(text(page.getByTestId("total")), "$ 11,00", "total con el descuento de línea");

  // Descuento a toda la venta, con el teclado.
  await page.keyboard.press("F7");
  const discountDialog = page.getByRole("dialog");
  await discountDialog.getByRole("heading", { name: "Descuento a toda la venta" }).waitFor();
  await option(discountDialog, "Monto");
  await discountDialog.getByLabel("Monto de descuento").fill("50");
  await discountDialog.getByRole("button", { name: "Aplicar" }).click();
  await visible(discountDialog.getByText("Escribe un monto que no pase del total de la venta."), "un descuento mayor que la venta no pasa");
  await discountDialog.getByLabel("Monto de descuento").fill("1");
  await discountDialog.getByRole("button", { name: "Aplicar" }).click();
  await discountDialog.waitFor({ state: "detached" });
  await eq(text(page.getByTestId("discount")), "−$ 1,00", "el descuento general se ve en la cuenta");
  await eq(text(page.getByTestId("total")), "$ 10,00", "total con los dos descuentos");
  await shot(page, "15-venta-con-descuentos");

  await page.getByRole("button", { name: "Dólares efectivo" }).click();
  await page.getByRole("group", { name: "Montos habituales" }).getByRole("button", { name: "Exacto" }).click();
  await focusIs(page, "Cobrar $ 10,00", "el cobro exacto de un toque salda la cuenta");
  await charge.click();
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  assert((await text(done)).includes("−$ 1,00"), "la venta registrada muestra el descuento");
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });

  // Se retoma la venta en espera, con el vuelto repartido.
  await page.getByRole("button", { name: "En espera (1)" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Retomar Señora de la blusa" }).click();
  await page.locator(".cart tbody tr").first().waitFor();
  await eq(text(page.locator(".cart-name")), "Blusa manga larga · M", "la venta en espera vuelve como estaba");
  await eq(page.getByRole("button", { name: /^En espera/ }).count(), 0, "y deja de estar en espera");

  // Paga 50 € por una blusa de 20 $: se proponen euros enteros y el resto en bolívares.
  await page.getByRole("button", { name: "Euros efectivo" }).click();
  await amount.fill("50");
  await amount.press("Enter");
  await eq(page.getByTestId("change").allTextContents().then((list) => list.join(" + ")), "€ 32,00 + Bs 199,54", "vuelto propuesto: euros enteros y céntimos en bolívares");
  await shot(page, "16-vuelto-propuesto");
  // No hay billetes de euro: quien cobra lo reparte a mano entre dólares y bolívares.
  await page.getByRole("button", { name: "Quitar el vuelto en Euros efectivo" }).click();
  await page.getByText("Falta entregar").waitFor();
  await page.getByRole("button", { name: "Dólares efectivo", exact: true }).click();
  await amount.fill("30");
  await amount.press("Enter");
  await page.getByRole("button", { name: "Bolívares efectivo", exact: true }).click();
  await amount.press("Enter");
  await eq(page.getByTestId("change").count(), 3, "el vuelto queda repartido en tres partes");
  await focusIs(page, "Cobrar $ 20,00", "con el vuelto completo, se puede cobrar");
  await shot(page, "17-vuelto-repartido");
  await charge.click();
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });

  // Quitar una línea se puede deshacer.
  await addToSale(page, "zapato", "37 · Negro");
  await page.getByRole("button", { name: "Quitar Zapato deportivo · 37 · Negro de la venta" }).click();
  await eq(page.locator(".cart tbody tr").count(), 0, "la línea se quita");
  await page.getByRole("button", { name: "Deshacer" }).click();
  await eq(page.locator(".cart tbody tr").count(), 1, "y vuelve al deshacer");
  await page.getByRole("button", { name: "Vaciar venta" }).click();
  await eq(page.locator(".cart tbody tr").count(), 0, "una venta de una sola línea se vacía sin preguntar");

  // Las ventas de la caja se pueden consultar.
  await page.getByRole("button", { name: "Ventas de esta caja" }).click();
  await page.getByRole("dialog").locator("tbody tr").first().waitFor();
  await eq(page.getByRole("dialog").locator("tbody tr").count(), 4, "la caja lleva cuatro ventas");
  await page.getByRole("dialog").getByRole("button", { name: "Ver la venta C01-000001" }).click();
  await page.getByRole("dialog").getByRole("heading", { name: "Venta C01-000001" }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });

  /* ---------- 9 · Impuestos: se activan y la venta los desglosa ---------- */
  step = "impuestos";
  await page.getByRole("button", { name: "Ajustes" }).click();
  await tab(page, "Impuestos");
  await page.getByRole("switch", { name: "Desglosar el impuesto en las ventas" }).check();
  await visible(page.locator("tbody tr", { hasText: "IVA general" }), "al activarlos aparecen las tasas");
  await eq(text(page.locator("tbody tr", { hasText: "IVA general" }).locator("td").nth(2)), "16 %", "tasa general del IVA");
  await shot(page, "18-ajustes-impuestos");

  await nav(page, "Vender");
  await search.waitFor();
  await addToSale(page, "zapato", "37 · Negro");
  await eq(text(page.getByTestId("total")), "$ 45,00", "con el impuesto incluido, el total no cambia");
  await becomes(page.getByTestId("tax"), "$ 6,21", "el impuesto incluido se desglosa");
  await page.getByRole("button", { name: "Dólares efectivo" }).click();
  await amount.press("Enter");
  await charge.click();
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  await done.getByRole("button", { name: "Guardar PDF" }).click();
  await done.getByText("Guardado en").waitFor();
  await shot(page, "19-venta-con-impuesto");
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });

  /* ---------- 10 · Facturación: formas libres, anular, auxiliar del libro y facturas de otro medio ---------- */
  step = "facturación";
  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByLabel("Nombre de la tienda").fill("Calzados Altamira");
  await page.getByLabel("Dirección (opcional)").fill("Av. Principal de Chacao, local 4, Caracas");
  await page.getByLabel("RIF (opcional)").fill("j001241345");
  await page.getByLabel("Nombre de la tienda").press("Enter");
  await page.getByText("Guardado", { exact: true }).waitFor();
  await eq(page.getByLabel("RIF (opcional)").inputValue(), "J-00124134-5", "el RIF de la tienda toma su formato");

  await tab(page, "Facturación");
  assert(await page.getByRole("radio", { name: /No uso Ventamas para facturar/ }).isChecked(), "la facturación viene apagada");
  await eq(page.getByRole("navigation").getByRole("button", { name: "Facturas" }).count(), 0, "apagada, no añade nada al menú");
  await page.locator(".invoice-mode", { hasText: "Imprimo mis facturas en formas libres" }).click();
  await visible(page.getByText("Antes de usar formas libres, comprueba que puedes"), "avisa de quién está obligado a máquina fiscal");
  await visible(page.getByText("Todavía no hay un lote registrado."), "sin lote de formas, lo dice");
  await page.getByLabel("Primer número de control").fill("101");
  await page.getByLabel("Último número de control").fill("150");
  await page.getByLabel("Imprenta (opcional)").fill("Imprenta Caracas, C.A.");
  await page.getByRole("button", { name: "Registrar lote" }).click();
  await visible(page.getByText("Próxima hoja: 00-00000101. Quedan 50."), "el lote registrado dice qué hoja toca");
  await page.getByLabel("Serie (opcional)").fill("a");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await visible(page.getByText("La próxima factura será la A-00000001."), "la numeración toma su serie");
  await visible(page.getByRole("navigation").getByRole("button", { name: "Facturas" }), "al activarla aparece la pantalla de facturas");
  await shot(page, "20-ajustes-facturacion");

  // Una venta a María, que se factura al cobrarla.
  await nav(page, "Vender");
  await search.waitFor();
  await addToSale(page, "zapato", "38 · Blanco");
  await page.keyboard.press("F6");
  await page.getByRole("dialog").getByRole("combobox", { name: "Buscar cliente" }).fill("12345678");
  await page.getByRole("dialog").getByRole("option", { name: /María Pérez/ }).click();
  await page.getByRole("button", { name: "Dólares efectivo" }).click();
  await amount.press("Enter");
  await charge.click();
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();

  await done.getByRole("button", { name: "Emitir factura" }).click();
  const issue = page.getByRole("dialog", { name: "Emitir factura" });
  await visible(issue.getByText("Será la factura A-00000001."), "la factura dice su número antes de emitirla");
  await eq(issue.getByLabel("Nombre o razón social").inputValue(), "María Pérez", "trae el nombre del cliente de la venta");
  await eq(issue.getByLabel("Cédula o RIF").inputValue(), "V-12345678", "y su documento");
  await eq(issue.getByLabel("Número de control de la hoja").inputValue(), "00-00000101", "propone la hoja que toca");
  await shot(page, "21-emitir-factura");
  await issue.getByRole("button", { name: "Emitir factura" }).click();
  await issue.waitFor({ state: "detached" });
  const box = done.getByRole("region", { name: "Factura" });
  await visible(box.getByText("Factura A-00000001"), "la venta muestra su factura");
  assert((await text(box)).includes("Control 00-00000101"), "con su número de control");
  await box.getByRole("button", { name: "Guardar copia" }).click();
  await box.getByText("Copia guardada en").waitFor();
  const invoicePdf = join(dataDir, "recibos", "factura-A-00000001.pdf");
  assert(existsSync(invoicePdf) && statSync(invoicePdf).size > 2000, "la copia de la factura se guarda como PDF");

  // El RIF salió mal: se anula y se emite otra, con el número y la hoja siguientes.
  await box.getByRole("button", { name: "Anular" }).click();
  const voidDialog = page.getByRole("dialog", { name: "Anular la factura A-00000001" });
  await voidDialog.getByRole("button", { name: "Anular factura" }).click();
  await visible(voidDialog.getByText("Escribe el motivo."), "anular pide el motivo");
  await voidDialog.getByLabel("Motivo").fill("Hoja mal impresa");
  await voidDialog.getByRole("button", { name: "Anular factura" }).click();
  await voidDialog.waitFor({ state: "detached" });
  await done.getByRole("button", { name: "Emitir factura" }).click();
  await visible(issue.getByText("Será la factura A-00000002."), "la numeración sigue, sin reutilizar la anulada");
  await eq(issue.getByLabel("Número de control de la hoja").inputValue(), "00-00000102", "y la hoja también");
  await issue.getByRole("button", { name: "Emitir factura" }).click();
  await issue.waitFor({ state: "detached" });
  await visible(box.getByText("Factura A-00000002"), "la venta queda con su factura nueva");
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });

  // El auxiliar del libro de ventas del mes.
  await nav(page, "Facturas");
  await page.locator("tbody tr").first().waitFor();
  await eq(page.locator("tbody tr").count(), 2, "el mes tiene las dos facturas");
  assert((await text(page.locator("tbody tr", { hasText: "A-00000001" }))).includes("Anulada"), "la anulada sigue en la lista, marcada");
  // 45 $ a 866,56: Bs 38.995,20, con el 16 % dentro.
  await eq(text(page.locator("tbody tr", { hasText: "A-00000002" }).locator("td").nth(5)), "Bs 38.995,20", "total de la factura en bolívares");
  await eq(text(page.locator("tfoot td").nth(0)), "Bs 33.613,86", "base imponible del mes");
  await eq(text(page.locator("tfoot td").nth(1)), "Bs 5.381,34", "impuesto del mes");
  await shot(page, "22-facturas");
  await page.getByRole("button", { name: "Exportar a hoja de cálculo" }).click();
  await page.getByText("Guardado en").waitFor();
  assert(readdirSync(join(dataDir, "libros")).some((name) => name.startsWith("auxiliar-libro-de-ventas-") && name.endsWith(".csv")), "el auxiliar del libro se exporta");

  // Quien factura con máquina fiscal solo anota el número de su factura en la venta.
  await page.getByRole("button", { name: "Ajustes" }).click();
  await tab(page, "Facturación");
  await page.locator(".invoice-mode", { hasText: "Facturo por otro medio y anoto el número" }).click();
  await nav(page, "Ventas");
  await page.getByRole("button", { name: "Ver la venta C01-000002" }).click();
  const sold = page.getByRole("dialog", { name: "Venta C01-000002" });
  await sold.getByRole("button", { name: "Anotar la factura de esta venta" }).click();
  const record = page.getByRole("dialog", { name: "Anotar factura" });
  await record.getByLabel("Número de la factura").fill("00012345");
  await record.getByLabel(/Número de control o registro/).fill("Z1B8001234");
  await record.getByRole("button", { name: "Anotar", exact: true }).click();
  await record.waitFor({ state: "detached" });
  await visible(sold.getByText("Factura 00012345"), "la factura de la máquina fiscal queda anotada en la venta");
  assert((await text(sold)).includes("emitida por otro medio"), "y se distingue de las emitidas por Ventamas");
  await sold.getByRole("button", { name: "Cerrar" }).last().click();
  await sold.waitFor({ state: "detached" });

  /* ---------- 11 · El inventario refleja lo vendido y avisa ---------- */
  step = "inventario tras vender";
  await nav(page, "Productos");
  await rowOf("Zapato deportivo").waitFor();
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(3).locator(".num")), "2", "se vendieron cuatro zapatos");
  assert((await text(rowOf("Zapato deportivo"))).includes("Por reponer"), "el zapato llegó a su mínimo");
  assert((await text(rowOf("Blusa manga larga"))).includes("Revisar existencias"), "la blusa vendida sin tener queda marcada");
  await page.getByRole("button", { name: /Por revisar/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
  await eq(text(page.locator("tbody tr .product-name")), "Blusa manga larga", "el filtro deja solo lo que hay que revisar");
  await page.getByRole("button", { name: /Por revisar/ }).click();
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 4);
  await shot(page, "23-productos-tras-vender");

  /* ---------- 12 · Historial de ventas y compras de un cliente ---------- */
  step = "historial";
  await nav(page, "Ventas");
  await page.locator("tbody tr").first().waitFor();
  await eq(page.locator("tbody tr").count(), 6, "el historial de hoy tiene las seis ventas");
  await eq(text(page.locator(".stat-value")), "$ 230,00", "total vendido hoy");
  await page.getByPlaceholder("Buscar por número de venta o cliente").fill("maria");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2);
  await shot(page, "24-historial");
  await nav(page, "Clientes");
  await page.getByRole("button", { name: "Ver las compras de María Pérez" }).click();
  await visible(page.getByText("Compras de María Pérez"), "desde el cliente se llega a sus compras");
  await eq(page.locator("tbody tr").count(), 2, "María tiene dos compras");
  await page.getByRole("button", { name: "Ver la venta C01-000001" }).click();
  await page.getByRole("dialog").getByRole("heading", { name: "Venta C01-000001" }).waitFor();
  await page.keyboard.press("Escape");

  /* ---------- 13 · Movimiento de efectivo, corte y cierre de caja ---------- */
  step = "cierre de caja";
  await nav(page, "Caja");
  const cashRow = (name) => page.locator("section tbody tr", { hasText: name }).first();
  await cashRow("Dólares efectivo").waitFor();
  // 20 de fondo + 40 + 10 + 45 + 45 cobrados − 30 de vuelto
  await eq(text(cashRow("Dólares efectivo").locator("td").last()), "$ 130,00", "dólares que debe haber");
  await eq(text(cashRow("Pago móvil").locator("td").last()), "Bs 21.664,00", "pago móvil que debe haber");
  await eq(text(cashRow("Euros efectivo").locator("td").last()), "€ 50,00", "euros que debe haber");

  await page.getByRole("button", { name: "Entrada o salida de efectivo" }).click();
  const move = page.getByRole("dialog");
  await move.getByLabel("De dónde").selectOption({ label: "Dólares efectivo" });
  await move.getByLabel("Monto").fill("5");
  await move.getByRole("button", { name: "Registrar" }).click();
  await visible(move.getByText("Escribe el motivo."), "una salida necesita motivo");
  await move.getByRole("group", { name: "Motivos habituales" }).getByRole("button", { name: "Gasto del local" }).click();
  await eq(move.getByLabel("Motivo", { exact: true }).inputValue(), "Gasto del local", "un motivo habitual se pone con un toque");
  await move.getByRole("button", { name: "Registrar" }).click();
  await move.waitFor({ state: "detached" });
  await eq(text(cashRow("Dólares efectivo").locator("td").last()), "$ 125,00", "tras sacar 5 $");
  await eq(text(cashRow("Dólares efectivo").locator("td").nth(4)), "−$ 5,00", "la salida se ve con su signo");
  await eq(text(cashRow("Dólares efectivo").locator("td").nth(3)), "$ 30,00", "el vuelto entregado se ve como monto");
  await shot(page, "25-caja-abierta");

  // Corte: lo que lleva la caja, sin cerrarla.
  await page.getByRole("button", { name: "Corte de caja" }).click();
  const cut = page.getByRole("dialog");
  await cut.getByRole("heading", { name: "Corte de caja" }).waitFor();
  assert((await text(cut)).includes("La caja sigue abierta"), "el corte avisa de que no cierra la caja");
  await cut.getByRole("button", { name: "Listo" }).click();
  await cut.waitFor({ state: "detached" });
  await visible(page.getByRole("button", { name: "Cerrar caja" }), "tras el corte, la caja sigue abierta");

  await page.getByRole("button", { name: "Cerrar caja" }).click();
  const close = page.getByRole("dialog", { name: "Cerrar caja" });
  await close.getByRole("button", { name: "Cerrar caja" }).click();
  await visible(close.getByText("Escribe lo contado de cada medio"), "no se cierra sin contar lo que se movió");
  // Los dólares se cuentan billete por billete.
  await close.getByRole("button", { name: "Contar billetes de Dólares efectivo" }).click();
  const bills = page.getByRole("dialog", { name: "Contar Dólares efectivo" });
  await bills.getByLabel("Billetes de $ 100,00").fill("1");
  await bills.getByLabel("Billetes de $ 20,00").fill("1");
  await bills.getByLabel("Billetes de $ 2,00").fill("2");
  await eq(text(bills.locator(".bills-total-value")), "$ 124,00", "el contador suma los billetes");
  await shot(page, "26-contar-billetes");
  await bills.getByRole("button", { name: "Usar este total" }).click();
  await bills.waitFor({ state: "detached" });
  await eq(close.getByLabel("Contado en Dólares efectivo").inputValue(), "124,00", "el total contado pasa al cierre");
  await close.getByLabel("Contado en Euros efectivo").fill("50");
  await close.getByLabel("Contado en Pago móvil").fill("21664");
  const bolivars = await text(close.locator("tbody tr", { hasText: "Bolívares efectivo" }).locator("td").nth(1));
  await close.getByLabel("Contado en Bolívares efectivo").fill(bolivars.replace("Bs ", ""));
  await close.getByLabel("Nota (opcional)").fill("Faltó un dólar");
  assert((await text(close.locator("tbody tr", { hasText: "Dólares efectivo" }))).includes("Falta $ 1,00"), "la diferencia se ve al contar");
  await eq(close.locator("[aria-invalid=true]").count(), 0, "con todo contado, ningún campo queda marcado en rojo");
  await page.mouse.move(5, 5);
  await shot(page, "27-cierre-contando");
  await close.getByRole("button", { name: "Cerrar caja" }).click();

  const report = page.getByRole("dialog");
  await report.getByRole("heading", { name: "Cierre de caja" }).waitFor();
  assert((await text(report)).includes("Falta $ 1,00"), "el cierre guarda la diferencia");
  await report.getByRole("button", { name: "Guardar PDF" }).click();
  await report.getByText("Guardado en").waitFor();
  assert(readdirSync(join(dataDir, "recibos")).some((name) => name.startsWith("cierre-")), "el cierre se guarda como PDF");
  await shot(page, "28-cierre");
  await report.getByRole("button", { name: "Listo" }).click();
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await page.getByRole("button", { name: "Ver cierre" }).waitFor();
  await eq(page.locator("section tbody tr").count(), 1, "la caja cerrada queda en el historial");

  await nav(page, "Vender");
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();

  /* ---------- 14 · Tasas y ajustes ---------- */
  step = "tasas y ajustes";
  await nav(page, "Tasas");
  await page.getByText("Confirmadas hoy").waitFor();
  await page.locator("tbody tr").first().waitFor();
  await eq(page.locator("tbody tr").count(), 2, "el historial tiene las dos tasas de hoy");
  await shot(page, "29-tasas");

  await page.getByRole("button", { name: "Ajustes" }).click();
  await tab(page, "Categorías");
  await visible(page.locator(".rubro", { hasText: "Zapatería y carteras" }).getByText("Cargado"), "el rubro elegido al inicio figura cargado");
  await page.getByRole("button", { name: "Ver los 25 tipos de comercio" }).click();
  await page.getByRole("button", { name: "Cargar las categorías de Ferretería, pinturas y electricidad" }).click();
  await visible(page.getByText("Se añadieron 14 categorías de Ferretería, pinturas y electricidad."), "se puede cargar otro rubro después");
  await visible(page.locator("tbody tr", { hasText: "Tornillos y fijación" }), "sus categorías aparecen en la lista");
  await shot(page, "30-ajustes-categorias");

  await tab(page, "Caja y pagos");
  await page.getByRole("switch", { name: /Euros efectivo/ }).uncheck();
  await page.getByRole("switch", { name: "Contar a ciegas" }).check();

  await tab(page, "Tienda");
  await page.locator("label.theme", { hasText: "Noche" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "noche");
  await page.waitForTimeout(250);
  await shot(page, "31-ajustes-noche");

  await nav(page, "Caja");
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await eq(page.getByLabel("Euros efectivo").count(), 0, "un medio desactivado ya no pide fondo");
  await shot(page, "32-caja-noche");

  // Con el conteo a ciegas, el cierre no enseña lo esperado.
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByText("Abierta desde").waitFor();
  await page.getByRole("button", { name: "Cerrar caja" }).click();
  const blind = page.getByRole("dialog", { name: "Cerrar caja" });
  await eq(blind.getByRole("columnheader", { name: "Debe haber" }).count(), 0, "a ciegas no se ve lo que debe haber");
  await eq(blind.getByRole("columnheader", { name: "Diferencia" }).count(), 0, "ni la diferencia");
  await blind.getByRole("button", { name: "Cerrar caja" }).click();
  await visible(blind.getByText("Escribe lo contado de cada medio. Donde no haya nada, escribe 0."), "a ciegas hay que contar todos los medios");
  for (const field of await blind.locator(".cash-count input").all()) await field.fill("0");
  await blind.getByRole("button", { name: "Cerrar caja" }).click();
  await page.getByRole("dialog").getByRole("heading", { name: "Cierre de caja" }).waitFor();
  await page.getByRole("dialog").getByRole("button", { name: "Listo" }).click();
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();

  // Sin desbordes en la ventana mínima.
  const win = await app.browserWindow(page);
  await win.evaluate((w) => w.setSize(960, 600));
  await page.waitForTimeout(300);
  for (const screen of ["Vender", "Ventas", "Facturas", "Productos", "Clientes", "Caja", "Tasas"]) {
    await nav(page, screen);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 0, `${screen} no debe desbordar en la ventana mínima (sobran ${overflow}px)`);
  }
  await app.close();

  /* ---------- 15 · Segunda apertura: todo sigue ahí ---------- */
  step = "segunda apertura";
  ({ app, page } = await launch());
  await eq(page.locator(".welcome").count(), 0, "el asistente no vuelve a aparecer");
  await eq(page.evaluate(() => document.documentElement.dataset.theme), "noche", "el tema persiste");
  await eq(text(page.locator(".brand-store")), "Calzados Altamira", "el nombre de la tienda persiste");
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await nav(page, "Productos");
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(3).locator(".num")), "2", "las existencias persisten");
  assert(!existsSync(join(dataDir, "ventamas.log")), "no se registró ningún fallo interno");
  await app.close();

  console.log(`\nOK   ${packaged ? "aplicación empaquetada" : "código compilado"}`);
  console.log(`  comprobaciones : ${checks}`);
  console.log(`  duración       : ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(`  capturas       : ${readdirSync(shots).length} en .e2e/capturas`);
} catch (error) {
  problems.push(String(error?.message ?? error).split("\n").slice(0, 12).join("\n"));
}

if (problems.length) {
  console.log(`\nFALLA  ${problems.length} problema(s)`);
  for (const p of problems) console.log(`  · ${p}`);
  process.exit(1);
}
