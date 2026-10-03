// Impresión de recibos y guardado como PDF. La interfaz dibuja el documento en su zona
// de impresión (la hoja de estilos de impresión oculta todo lo demás) y aquí se manda
// a la impresora o a un archivo con el tamaño de papel del recibo.

import { app, shell, type BrowserWindow } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP, type PdfJob, type PrinterInfo, type PrintJob } from "@shared/api";
import { UserError } from "@shared/errors";
import type { Settings } from "@shared/settings";
import { asInteger, asObject, asString } from "@shared/validate";
import type { Handler } from "./modules";

const MICRONS_PER_MM = 1000;
const MIN_HEIGHT_MM = 40;
const MAX_HEIGHT_MM = 3000;

function parseJob(value: unknown): PrintJob {
  const job = asObject(value, "impresión");
  const width = job.width;
  if (width !== 58 && width !== 80) throw new TypeError("Ancho de papel no válido.");
  const height = Math.min(MAX_HEIGHT_MM, Math.max(MIN_HEIGHT_MM, Math.ceil(asInteger(job.height, "alto"))));
  return { width, height };
}

interface PrintingOptions {
  window: () => BrowserWindow | undefined;
  settings: () => Settings;
  dataDir: string;
  handle(channel: string, handler: Handler): void;
}

export function registerPrinting({ window, settings, dataDir, handle }: PrintingOptions): void {
  const current = (): BrowserWindow => {
    const win = window();
    if (!win) throw new Error("No hay ventana para imprimir.");
    return win;
  };

  // Los PDF van a Documentos, donde una persona los encuentra. En las pruebas, a la carpeta de datos.
  const pdfDir = (): string =>
    process.env.VENTAMAS_DATA_DIR ? join(dataDir, "recibos") : join(app.getPath("documents"), "Ventamas", "Recibos");

  handle(APP.printers, async (): Promise<PrinterInfo[]> => {
    const printers = await current().webContents.getPrintersAsync();
    return printers.map((p) => ({ name: p.name, displayName: p.displayName || p.name }));
  });

  handle(APP.print, async (value: unknown): Promise<void> => {
    const job = parseJob(value);
    const deviceName = settings()["receipt.printer"];
    const win = current();
    await new Promise<void>((resolve, reject) => {
      win.webContents.print(
        {
          // Con impresora configurada se imprime directo; sin ella, Windows pregunta cuál usar.
          silent: deviceName !== "",
          deviceName: deviceName || undefined,
          printBackground: true,
          margins: { marginType: "none" },
          pageSize: { width: job.width * MICRONS_PER_MM, height: job.height * MICRONS_PER_MM },
        },
        (success, reason) => {
          // Cerrar el diálogo de Windows sin imprimir no es un error.
          if (success || /cancel/i.test(reason)) resolve();
          else reject(new UserError(`No se pudo imprimir. Revisa que la impresora esté encendida y conectada. (${reason})`));
        }
      );
    });
  });

  handle(APP.savePdf, async (value: unknown): Promise<string> => {
    const job = parseJob(value);
    const name = asString((value as PdfJob).name, "nombre").replace(/[^\w.-]+/g, "_").slice(0, 80) || "recibo";
    const data = await current().webContents.printToPDF({
      printBackground: true,
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      // printToPDF mide el papel en pulgadas.
      pageSize: { width: job.width / 25.4, height: job.height / 25.4 },
    });
    const dir = pdfDir();
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `${name}.pdf`);
    try {
      writeFileSync(file, data);
    } catch {
      throw new UserError("No se pudo guardar el PDF. Si lo tienes abierto en otro programa, ciérralo e inténtalo de nuevo.");
    }
    return file;
  });

  handle(APP.showFile, (file: unknown): void => {
    const path = asString(file, "archivo");
    // Solo se muestran archivos que la propia aplicación guardó.
    if (!path.startsWith(pdfDir())) throw new TypeError("Archivo fuera de la carpeta de recibos.");
    shell.showItemInFolder(path);
  });
}
