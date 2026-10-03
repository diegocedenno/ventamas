import { app, BrowserWindow, dialog, ipcMain, Menu, shell } from "electron";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { APP, BOOT_CHANNEL, GENERIC_ERROR, type BootData, type Result } from "@shared/api";
import { UserError } from "@shared/errors";
import { getTheme } from "@shared/themes";
import { readSettings } from "@modules/nucleo/main/settings";
import { mainModules } from "@modules/registry.main";
import { backupBeforeUpdate } from "./db/backup";
import { openDatabase, type Db } from "./db/database";
import { runMigrations } from "./db/migrate";
import { createLogger } from "./log";
import type { Handler } from "./modules";
import { registerPrinting } from "./printing";

// Carpeta de datos alternativa: la usan las pruebas automáticas para no tocar la tienda real.
// En desarrollo los datos van a una carpeta aparte de la aplicación instalada.
if (process.env.VENTAMAS_DATA_DIR) {
  app.setPath("userData", process.env.VENTAMAS_DATA_DIR);
} else if (!app.isPackaged) {
  app.setPath("userData", join(app.getPath("appData"), "Ventamas-desarrollo"));
}

let db: Db | undefined;
let mainWindow: BrowserWindow | undefined;

function startDatabase(dataDir: string): Db {
  mkdirSync(dataDir, { recursive: true });
  const database = openDatabase(join(dataDir, "ventamas.db"));
  try {
    runMigrations(
      database,
      mainModules.map((m) => ({ module: m.manifest.id, migrations: m.migrations })),
      { backup: () => backupBeforeUpdate(database, dataDir) }
    );
  } catch (error) {
    database.close();
    throw error;
  }
  return database;
}

function registerIpc(database: Db, dataDir: string): void {
  const logError = createLogger(dataDir);

  // Solo la ventana de la aplicación puede llamar a estas funciones.
  const fromApp = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent): boolean =>
    mainWindow !== undefined && event.sender === mainWindow.webContents;

  ipcMain.on(BOOT_CHANNEL, (event) => {
    if (!fromApp(event)) {
      event.returnValue = null;
      return;
    }
    const boot: BootData = {
      settings: readSettings(database),
      info: { version: app.getVersion(), dataDir, electron: process.versions.electron ?? "" },
    };
    event.returnValue = boot;
  });

  const handle = (channel: string, handler: Handler): void => {
    ipcMain.handle(channel, async (event, ...args: unknown[]): Promise<Result<unknown>> => {
      if (!fromApp(event)) return { ok: false, error: GENERIC_ERROR };
      try {
        return { ok: true, value: await handler(...args) };
      } catch (error) {
        if (error instanceof UserError) return { ok: false, error: error.message };
        logError(channel, error);
        return { ok: false, error: GENERIC_ERROR };
      }
    });
  };

  handle(APP.openDataDir, async () => {
    await shell.openPath(dataDir);
  });

  registerPrinting({ window: () => mainWindow, settings: () => readSettings(database), dataDir, handle });

  for (const module of mainModules) module.register({ db: database, dataDir, handle });
}

function createWindow(database: Db): BrowserWindow {
  const theme = getTheme(readSettings(database)["ui.theme"]);
  const window = new BrowserWindow({
    title: "Ventamas",
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    show: false,
    // El fondo del tema evita un destello blanco mientras carga la interfaz.
    backgroundColor: theme.colors.bg,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.once("ready-to-show", () => window.show());

  // La ventana solo muestra la aplicación: nada de navegar a otros sitios ni abrir ventanas.
  // (Recargar la propia página sí se permite: lo usa el modo de desarrollo.)
  window.webContents.on("will-navigate", (event, url) => {
    if (url !== window.webContents.getURL()) event.preventDefault();
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });

  if (process.env.ELECTRON_RENDERER_URL) {
    void window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    void window.loadFile(join(__dirname, "../renderer/index.html"));
  }
  return window;
}

if (!app.requestSingleInstanceLock()) {
  // Ya hay una ventana de Ventamas abierta: dos procesos no deben escribir los mismos datos.
  app.quit();
} else {
  app.on("second-instance", () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.on("window-all-closed", () => app.quit());

  app.on("will-quit", () => {
    db?.close();
    db = undefined;
  });

  void app.whenReady().then(() => {
    if (app.isPackaged) Menu.setApplicationMenu(null);
    const dataDir = app.getPath("userData");
    try {
      db = startDatabase(dataDir);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      dialog.showErrorBox("Ventamas no pudo abrir los datos de la tienda", `${reason}\n\nCarpeta de datos: ${dataDir}`);
      app.exit(1);
      return;
    }
    registerIpc(db, dataDir);
    mainWindow = createWindow(db);
    mainWindow.on("closed", () => {
      mainWindow = undefined;
    });
  });
}
