// Prueba de extremo a extremo: abre la aplicación de verdad y la usa como un usuario.
// Uso: npm run build && npm run e2e            (prueba el código compilado en out/)
//      npm run e2e -- --packaged                (prueba dist/win-unpacked/Ventamas.exe)
//
// Trabaja en una carpeta de datos temporal (.e2e/datos), nunca en la tienda real.
// Deja capturas de cada tema en .e2e/capturas para revisarlas a ojo.
import { _electron as electron } from "playwright";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packaged = process.argv.includes("--packaged");
const dataDir = join(root, ".e2e", "datos");
const shots = join(root, ".e2e", "capturas");

rmSync(dataDir, { recursive: true, force: true });
rmSync(shots, { recursive: true, force: true });
mkdirSync(shots, { recursive: true });

const THEMES = ["Pizarra", "Océano", "Bosque", "Terracota", "Vino", "Lavanda", "Noche", "Carbón"];
const problems = [];
let checks = 0;

function assert(condition, message) {
  checks++;
  if (!condition) throw new Error(`Aserción fallida: ${message}`);
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

const themeOf = (page) => page.evaluate(() => document.documentElement.dataset.theme);
const bgOf = (page) => page.evaluate(() => getComputedStyle(document.body).backgroundColor);

try {
  // 1 · Primera apertura: instalación nueva
  let { app, page } = await launch();
  const started = Date.now();

  assert((await app.evaluate(({ app }) => app.getName())) === "Ventamas", "el nombre de la aplicación debe ser Ventamas");
  assert((await page.title()) === "Ventamas", "el título de la ventana debe ser Ventamas");
  assert((await page.locator(".brand-name").textContent()) === "Ventamas", "la marca debe verse en la barra lateral");
  assert((await page.locator(".brand-store").textContent()) === "Tu tienda", "una tienda sin nombre se muestra como «Tu tienda»");
  assert((await themeOf(page)) === "pizarra", "el tema por defecto es Pizarra");
  assert(existsSync(join(dataDir, "ventamas.db")), "la base de datos debe crearse en la carpeta de datos");
  assert(
    (await page.evaluate(() => document.fonts.check('16px "Inter"'))) === true,
    "la fuente incluida debe cargarse sin internet"
  );
  assert(
    (await page.evaluate(() => typeof window.require === "undefined" && typeof window.process === "undefined")) === true,
    "la interfaz no debe tener acceso a Node"
  );
  await page.screenshot({ path: join(shots, "01-inicio.png") });

  // 2 · Ajustes con el teclado y con el ratón
  await page.getByRole("button", { name: "Abrir Ajustes" }).click();
  assert((await page.getByRole("heading", { level: 1 }).textContent()) === "Ajustes", "el botón de Inicio lleva a Ajustes");
  assert(
    (await page.locator(".nav-item[aria-current='page']").textContent()) === "Ajustes",
    "el menú marca la pantalla actual"
  );

  const name = page.getByLabel("Nombre de la tienda");
  const save = page.getByRole("button", { name: "Guardar" });
  assert(await save.isDisabled(), "Guardar está desactivado si no hay cambios");
  await name.fill("  Calzados   Altamira  ");
  await name.press("Enter");
  await page.getByText("Guardado").waitFor();
  assert((await page.locator(".brand-store").textContent()) === "Calzados Altamira", "el nombre guardado aparece en la barra lateral");
  assert((await name.inputValue()) === "Calzados Altamira", "el nombre se limpia de espacios sobrantes");

  // 3 · Los ocho temas: se aplican al instante y cambian el fondo
  const radios = page.getByRole("radio");
  assert((await radios.count()) === 8, "deben ofrecerse ocho temas");
  const backgrounds = new Set();
  for (const [index, theme] of THEMES.entries()) {
    // Se toca la tarjeta, como haría una persona: el botón de opción en sí no se ve.
    await page.locator("label.theme", { hasText: theme }).click();
    await page.waitForFunction((n) => document.querySelectorAll("input[name=tema]")[n].checked, index);
    await page.waitForTimeout(250);
    backgrounds.add(await bgOf(page));
    await page.screenshot({ path: join(shots, `02-tema-${index + 1}-${await themeOf(page)}.png`) });
  }
  assert(backgrounds.size === 8, `cada tema debe tener su propio fondo (hay ${backgrounds.size})`);

  // Con el teclado: las flechas recorren los temas
  await page.getByRole("radio", { name: /^Pizarra/ }).focus();
  await page.keyboard.press("ArrowRight");
  await page.waitForFunction(() => document.documentElement.dataset.theme === "oceano");
  await page.locator("label.theme", { hasText: "Vino" }).click();
  await page.waitForFunction(() => document.documentElement.dataset.theme === "vino");
  const vinoBg = await bgOf(page);

  // 4 · Sin desbordes en la ventana mínima
  const win = await app.browserWindow(page);
  await win.evaluate((w) => w.setSize(960, 600));
  await page.waitForTimeout(300);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert(overflow <= 0, `no debe haber desplazamiento horizontal en la ventana mínima (sobran ${overflow}px)`);
  await page.screenshot({ path: join(shots, "03-ventana-minima.png") });

  await app.close();

  // 5 · Segunda apertura: todo sigue como se dejó
  ({ app, page } = await launch());
  assert((await themeOf(page)) === "vino", "el tema elegido persiste al reabrir");
  assert((await bgOf(page)) === vinoBg, "el color de fondo persiste al reabrir");
  assert((await page.locator(".brand-store").textContent()) === "Calzados Altamira", "el nombre de la tienda persiste al reabrir");
  assert(
    (await page.getByRole("heading", { level: 1 }).textContent()) === "Hola, Calzados Altamira",
    "Inicio saluda con el nombre de la tienda"
  );
  assert(!existsSync(join(dataDir, "respaldos")), "sin migraciones pendientes no se crea respaldo");
  await page.screenshot({ path: join(shots, "04-reabierta.png") });
  await app.close();

  console.log(`\nOK   ${packaged ? "aplicación empaquetada" : "código compilado"}`);
  console.log(`  comprobaciones : ${checks}`);
  console.log(`  duración       : ${((Date.now() - started) / 1000).toFixed(1)} s`);
  console.log(`  capturas       : ${readdirSync(shots).length} en .e2e/capturas`);
} catch (error) {
  problems.push(String(error?.message ?? error));
}

if (problems.length) {
  console.log(`\nFALLA  ${problems.length} problema(s)`);
  for (const p of problems) console.log(`  · ${p}`);
  process.exit(1);
}
