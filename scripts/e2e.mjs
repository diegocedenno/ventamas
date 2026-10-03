// Prueba de extremo a extremo: abre la aplicación de verdad y la usa como una tienda.
// Uso: npm run build && npm run e2e            (prueba el código compilado en out/)
//      npm run e2e -- --packaged                (prueba dist/win-unpacked/Ventamas.exe)
//
// Recorre un día completo: confirmar la tasa, abrir la caja, crear productos con tallas
// y colores, vender (con ratón, con teclado y con código de barras), guardar el recibo
// y cerrar la caja. Trabaja en una carpeta de datos temporal (.e2e/datos), nunca en la
// tienda real, y deja capturas en .e2e/capturas para revisarlas a ojo.
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
  await page.waitForSelector(".shell");
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
  /* ---------- 1 · Primera apertura: nada configurado ---------- */
  step = "primera apertura";
  let { app, page } = await launch();

  await eq(app.evaluate(({ app }) => app.getName()), "Ventamas", "nombre de la aplicación");
  await eq(page.title(), "Ventamas", "título de la ventana");
  await eq(text(page.locator(".brand-store")), "Tu tienda", "tienda sin nombre");
  const menu = await page.getByRole("navigation").getByRole("button").allTextContents();
  assert(menu.join(",") === "Vender,Productos,Caja,Tasas", `menú en orden (es ${menu.join(",")})`);
  assert(existsSync(join(dataDir, "ventamas.db")), "la base de datos se crea en la carpeta de datos");
  assert(await page.evaluate(() => document.fonts.check('16px "Inter"')), "la fuente incluida carga sin internet");
  assert(
    await page.evaluate(() => typeof window.require === "undefined" && typeof window.process === "undefined"),
    "la interfaz no tiene acceso a Node"
  );

  /* ---------- 2 · La tasa de hoy ---------- */
  step = "tasa del día";
  await page.getByRole("heading", { name: "Confirma la tasa de hoy" }).waitFor();
  await shot(page, "01-tasa-pendiente");
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
  await shot(page, "02-caja-cerrada");
  await page.getByRole("button", { name: "Abrir caja" }).click();
  await page.getByText("Abierta desde").waitFor();

  /* ---------- 4 · Productos con tallas y colores ---------- */
  step = "productos";
  await nav(page, "Productos");
  await page.getByRole("heading", { name: "Todavía no hay productos" }).waitFor();
  await page.getByRole("button", { name: "Nuevo producto" }).first().click();
  const editor = page.getByRole("dialog");
  await focusIs(page, "", "el editor abre con el foco en el nombre");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await visible(editor.getByText("Escribe el nombre del producto."), "sin nombre, avisa junto al campo");

  await editor.getByLabel("Nombre").fill("Zapato deportivo");
  await editor.getByLabel("Categoría").fill("Calzado");
  await editor.getByLabel("Precio de venta").fill("45");
  await editor.getByLabel("Costo (opcional)").fill("28,50");
  await editor.getByLabel("Tallas").fill("37, 38");
  await editor.getByLabel("Colores").fill("Negro, Blanco");
  await eq(editor.locator(".pieces tbody tr").count(), 4, "dos tallas por dos colores dan cuatro piezas");
  await editor.getByRole("button", { name: "Quitar 37 Blanco" }).click();
  await eq(editor.locator(".pieces tbody tr").count(), 3, "una combinación quitada desaparece");
  await editor.getByLabel("Existencias 37 Negro").fill("2");
  await editor.getByLabel("Existencias 38 Negro").fill("3");
  await editor.getByLabel("Existencias 38 Blanco").fill("1");
  await editor.getByLabel("Código 38 Negro").fill("7591234000018");
  await shot(page, "03-editor-producto");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await editor.waitFor({ state: "detached" });

  await page.getByRole("button", { name: "Nuevo producto" }).click();
  await editor.getByLabel("Nombre").fill("Blusa manga larga");
  await editor.getByLabel("Categoría").fill("Ropa de dama");
  await editor.getByLabel("Precio de venta").fill("20");
  await editor.getByLabel("Tallas").fill("S, M");
  await editor.getByLabel("Existencias M").fill("1");
  await editor.getByRole("button", { name: "Guardar" }).click();
  await editor.waitFor({ state: "detached" });

  const rowOf = (name) => page.locator("tbody tr", { hasText: name });
  await rowOf("Blusa manga larga").waitFor();
  await eq(page.locator("tbody tr").count(), 2, "la lista muestra los dos productos");
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(1)), "$ 45,00", "precio del zapato");
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(3)), "6", "existencias totales del zapato");

  // Al reabrir el producto, la combinación quitada sigue quitada.
  await rowOf("Zapato deportivo").getByRole("button", { name: "Zapato deportivo" }).click();
  await editor.getByRole("heading", { name: "Editar producto" }).waitFor();
  await eq(editor.locator(".pieces tbody tr").count(), 3, "el producto reabre con sus tres piezas");
  await eq(editor.getByLabel("Costo (opcional)").inputValue(), "28,50", "el costo se conserva");
  await editor.getByRole("button", { name: "Cancelar" }).click();

  await page.getByPlaceholder("Buscar por nombre o categoría").fill("dama");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 1);
  await page.getByPlaceholder("Buscar por nombre o categoría").fill("");
  await page.waitForFunction(() => document.querySelectorAll("tbody tr").length === 2);
  await shot(page, "04-productos");

  /* ---------- 5 · La venta de referencia del PRD, con el ratón ---------- */
  step = "venta de referencia";
  await nav(page, "Vender");
  const search = page.getByRole("combobox", { name: "Buscar producto" });
  await search.waitFor();
  await hasFocus(search, "la pantalla de venta abre con el foco en el buscador");
  const charge = page.getByRole("button", { name: /^Cobrar/ });
  assert(await charge.isDisabled(), "sin productos no se puede cobrar");

  await addToSale(page, "zapato", "38 · Negro");
  await addToSale(page, "blusa", "M Hay 1");
  await eq(text(page.getByTestId("total")), "$ 65,00", "total de la venta");
  await eq(text(page.getByTestId("total-equivalents")), "Bs 56.326,40 · € 57,83", "total en las otras monedas");
  assert(await charge.isDisabled(), "sin pagos no se puede cobrar");

  await page.getByRole("button", { name: "Dólares efectivo" }).click();
  const amount = page.getByTestId("entry-amount");
  await eq(amount.inputValue(), "65,00", "el monto propuesto es lo que falta");
  await amount.fill("40");
  await amount.press("Enter");
  await eq(text(page.getByTestId("due")), "$ 25,00", "tras pagar 40 $, falta");
  await eq(text(page.getByTestId("due-equivalents")), "Bs 21.664,00 · € 22,24", "lo que falta en las otras monedas");
  await shot(page, "05-venta-a-medio-cobrar");

  await page.getByRole("button", { name: "Pago móvil" }).click();
  await eq(amount.inputValue(), "21664,00", "el resto se propone en bolívares");
  await page.getByLabel("Referencia (opcional)").fill("4821");
  await page.getByRole("button", { name: "Agregar" }).click();
  await focusIs(page, "Cobrar $ 65,00", "con la cuenta saldada, el foco pasa a Cobrar");
  await shot(page, "06-venta-lista");
  await charge.click();

  const done = page.getByRole("dialog");
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  assert((await text(done)).includes("C01-000001"), "la primera venta es la C01-000001");
  await focusIs(page, "Nueva venta", "el foco queda en Nueva venta");
  await shot(page, "07-venta-registrada");
  await done.getByRole("button", { name: "Guardar PDF" }).click();
  await done.getByText("Guardado en").waitFor();
  const receipt = join(dataDir, "recibos", "C01-000001.pdf");
  assert(existsSync(receipt) && statSync(receipt).size > 2000, "el recibo se guarda como PDF");
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });
  await hasFocus(search, "tras la venta, el foco vuelve al buscador");
  await eq(text(page.getByTestId("total")), "$ 0,00", "la pantalla queda lista para otra venta");

  /* ---------- 6 · Venta solo con teclado, código de barras y vuelto ---------- */
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
  await shot(page, "08-venta-con-vuelto");
  await page.keyboard.press("Enter");
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  assert((await text(done)).includes("Bs 1.004,80"), "la venta registrada muestra el vuelto");
  await page.keyboard.press("Enter");
  await done.waitFor({ state: "detached" });

  /* ---------- 7 · Vender sin existencias, con el vuelto repartido ---------- */
  step = "venta sin existencias";
  await search.fill("blusa");
  await page.getByRole("option").first().waitFor();
  await search.press("Enter");
  await visible(page.getByRole("dialog").getByRole("button", { name: "M Sin existencias" }), "la pieza agotada lo dice");
  await page.getByRole("dialog").getByRole("button", { name: "M Sin existencias" }).click();
  await visible(page.locator(".cart .badge--warn", { hasText: "Sin existencias" }), "la venta avisa de la pieza agotada");

  // Paga 50 € por una blusa de 20 $: el vuelto se reparte entre 30 $ y el resto en bolívares.
  await page.getByRole("button", { name: "Euros efectivo" }).click();
  await amount.fill("50");
  await amount.press("Enter");
  await page.getByRole("button", { name: "Quitar el vuelto en Euros efectivo" }).click();
  await page.getByText("Falta entregar").waitFor();
  await page.getByRole("button", { name: "Dólares efectivo" }).click();
  await amount.fill("30");
  await amount.press("Enter");
  await page.getByRole("button", { name: "Bolívares efectivo" }).click();
  await amount.press("Enter");
  await eq(page.getByTestId("change").count(), 2, "el vuelto queda en dos partes");
  await shot(page, "09-vuelto-repartido");
  await charge.click();
  await done.getByRole("heading", { name: "Venta registrada" }).waitFor();
  await done.getByRole("button", { name: "Nueva venta" }).click();
  await done.waitFor({ state: "detached" });

  // Las ventas de la caja se pueden consultar.
  await page.getByRole("button", { name: "Ventas de esta caja" }).click();
  await page.getByRole("dialog").locator("tbody tr").first().waitFor();
  await eq(page.getByRole("dialog").locator("tbody tr").count(), 3, "la caja lleva tres ventas");
  await page.getByRole("dialog").getByRole("button", { name: "Ver" }).last().click();
  await page.getByRole("dialog").getByRole("heading", { name: "Venta C01-000001" }).waitFor();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "detached" });

  /* ---------- 8 · El inventario refleja lo vendido ---------- */
  step = "inventario tras vender";
  await nav(page, "Productos");
  await rowOf("Zapato deportivo").waitFor();
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(3)), "4", "se vendieron dos zapatos");
  assert((await text(rowOf("Blusa manga larga"))).includes("Revisar existencias"), "la blusa vendida sin tener queda marcada");

  /* ---------- 9 · Movimiento de efectivo y cierre de caja ---------- */
  step = "cierre de caja";
  await nav(page, "Caja");
  const cashRow = (name) => page.locator("section tbody tr", { hasText: name }).first();
  await cashRow("Dólares efectivo").waitFor();
  // 20 de fondo + 40 cobrados − 30 de vuelto
  await eq(text(cashRow("Dólares efectivo").locator("td").last()), "$ 30,00", "dólares que debe haber");
  await eq(text(cashRow("Pago móvil").locator("td").last()), "Bs 21.664,00", "pago móvil que debe haber");
  await eq(text(cashRow("Euros efectivo").locator("td").last()), "€ 50,00", "euros que debe haber");

  await page.getByRole("button", { name: "Entrada o salida de efectivo" }).click();
  const move = page.getByRole("dialog");
  await move.getByLabel("De dónde").selectOption({ label: "Dólares efectivo" });
  await move.getByLabel("Monto").fill("5");
  await move.getByLabel("Motivo").fill("Almuerzo");
  await move.getByRole("button", { name: "Registrar" }).click();
  await move.waitFor({ state: "detached" });
  await eq(text(cashRow("Dólares efectivo").locator("td").last()), "$ 25,00", "tras sacar 5 $ para el almuerzo");
  await eq(text(cashRow("Dólares efectivo").locator("td").nth(4)), "−$ 5,00", "la salida se ve con su signo");
  await eq(text(cashRow("Dólares efectivo").locator("td").nth(3)), "$ 30,00", "el vuelto entregado se ve como monto");
  await shot(page, "10-caja-abierta");

  await page.getByRole("button", { name: "Cerrar caja" }).click();
  const close = page.getByRole("dialog");
  await close.getByRole("button", { name: "Cerrar caja" }).click();
  await visible(close.getByText("Escribe lo contado de cada medio"), "no se cierra sin contar lo que se movió");
  await close.getByLabel("Contado en Dólares efectivo").fill("24");
  await close.getByLabel("Contado en Euros efectivo").fill("50");
  await close.getByLabel("Contado en Pago móvil").fill("21664");
  const bolivars = await text(close.locator("tbody tr", { hasText: "Bolívares efectivo" }).locator("td").nth(1));
  await close.getByLabel("Contado en Bolívares efectivo").fill(bolivars.replace("Bs ", ""));
  await close.getByLabel("Nota (opcional)").fill("Faltó un dólar");
  assert((await text(close.locator("tbody tr", { hasText: "Dólares efectivo" }))).includes("Falta $ 1,00"), "la diferencia se ve al contar");
  await eq(close.locator("[aria-invalid=true]").count(), 0, "con todo contado, ningún campo queda marcado en rojo");
  await page.mouse.move(5, 5);
  await shot(page, "11-cierre-contando");
  await close.getByRole("button", { name: "Cerrar caja" }).click();

  const report = page.getByRole("dialog");
  await report.getByRole("heading", { name: "Cierre de caja" }).waitFor();
  assert((await text(report)).includes("Falta $ 1,00"), "el cierre guarda la diferencia");
  await report.getByRole("button", { name: "Guardar PDF" }).click();
  await report.getByText("Guardado en").waitFor();
  assert(readdirSync(join(dataDir, "recibos")).some((name) => name.startsWith("cierre-")), "el cierre se guarda como PDF");
  await shot(page, "12-cierre");
  await report.getByRole("button", { name: "Listo" }).click();
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await page.getByRole("button", { name: "Ver cierre" }).waitFor();
  await eq(page.locator("section tbody tr").count(), 1, "la caja cerrada queda en el historial");

  await nav(page, "Vender");
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();

  /* ---------- 10 · Tasas y ajustes ---------- */
  step = "tasas y ajustes";
  await nav(page, "Tasas");
  await page.getByText("Confirmadas hoy").waitFor();
  await page.locator("tbody tr").first().waitFor();
  await eq(page.locator("tbody tr").count(), 2, "el historial tiene las dos tasas de hoy");
  await shot(page, "13-tasas");

  await page.getByRole("button", { name: "Ajustes" }).click();
  await page.getByLabel("Nombre de la tienda").fill("Calzados Altamira");
  await page.getByLabel("Nombre de la tienda").press("Enter");
  await page.getByText("Guardado", { exact: true }).waitFor();
  await page.getByRole("switch", { name: /Euros efectivo/ }).uncheck();
  await page.locator("label.theme", { hasText: "Noche" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "noche");
  await page.waitForTimeout(250);
  await shot(page, "14-ajustes-noche");

  await nav(page, "Caja");
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await eq(page.getByLabel("Euros efectivo").count(), 0, "un medio desactivado ya no pide fondo");
  await shot(page, "15-caja-noche");

  // Sin desbordes en la ventana mínima.
  const win = await app.browserWindow(page);
  await win.evaluate((w) => w.setSize(960, 600));
  await page.waitForTimeout(300);
  for (const screen of ["Vender", "Productos", "Caja", "Tasas"]) {
    await nav(page, screen);
    await page.waitForTimeout(150);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    assert(overflow <= 0, `${screen} no debe desbordar en la ventana mínima (sobran ${overflow}px)`);
  }
  await app.close();

  /* ---------- 11 · Segunda apertura: todo sigue ahí ---------- */
  step = "segunda apertura";
  ({ app, page } = await launch());
  await eq(page.evaluate(() => document.documentElement.dataset.theme), "noche", "el tema persiste");
  await eq(text(page.locator(".brand-store")), "Calzados Altamira", "el nombre de la tienda persiste");
  await page.getByRole("heading", { name: "La caja está cerrada" }).waitFor();
  await nav(page, "Productos");
  await eq(text(rowOf("Zapato deportivo").locator("td").nth(3)), "4", "las existencias persisten");
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
