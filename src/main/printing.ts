// Impresión de recibos y guardado como PDF. La interfaz dibuja el documento en su zona
// de impresión (la hoja de estilos de impresión oculta todo lo demás) y aquí se manda
// a la impresora o a un archivo con el tamaño de papel del recibo.

import { app, shell, type BrowserWindow } from "electron";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { APP, type PdfJob, type PrinterInfo, type PrintJob } from "@shared/api";
import { UserError } from "@shared/errors";
import { INVOICE_PAPERS, type InvoicePaper, type Settings } from "@shared/settings";
import { asInteger, asObject, asString } from "@shared/validate";
import type { Handler } from "./modules";

const MICRONS_PER_MM = 1000;
const MIN_HEIGHT_MM = 40;
const MAX_HEIGHT_MM = 3000;

/** Hojas en las que se imprimen documentos de página completa, en milímetros. */
const SHEETS: Record<InvoicePaper, { width: number; height: number }> = {
  carta: { width: 215.9, height: 279.4 },
  "media-carta": { width: 215.9, height: 139.7 },
};

const isSheet = (paper: unknown): paper is InvoicePaper => INVOICE_PAPERS.includes(paper as InvoicePaper);

/** El tamaño del papel de un trabajo: el rollo del recibo, con el alto de su contenido, o una hoja. */
function parseJob(value: unknown): { sheet: boolean; width: number; height: number } {
  const job = asObject(value, "impresión");
  if (isSheet(job.paper)) return { sheet: true, ...SHEETS[job.paper] };
  if (job.paper !== 58 && job.paper !== 80) throw new TypeError("Papel no válido.");
  const height = Math.min(MAX_HEIGHT_MM, Math.max(MIN_HEIGHT_MM, Math.ceil(asInteger(job.height, "alto"))));
  return { sheet: false, width: job.paper, height };
}

/**
 * Carpeta donde van los archivos que la persona pide guardar: en Documentos, donde los
 * encuentra. En las pruebas, dentro de la carpeta de datos.
 */
export function documentsDirOf(dataDir: string): string {
  return process.env.VENTAMAS_DATA_DIR ? dataDir : join(app.getPath("documents"), "Ventamas");
}

interface PrintingOptions {
  window: () => BrowserWindow | undefined;
  settings: () => Settings;
  documentsDir: string;
  handle(channel: string, handler: Handler): void;
}

export function registerPrinting({ window, settings, documentsDir, handle }: PrintingOptions): void {
  const current = (): BrowserWindow => {
    const win = window();
    if (!win) throw new Error("No hay ventana para imprimir.");
    return win;
  };

  const pdfDir = (): string => join(documentsDir, process.env.VENTAMAS_DATA_DIR ? "recibos" : "Recibos");

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
          // Un recibo, con impresora configurada, sale directo; sin ella, Windows pregunta cuál
          // usar. Una hoja pregunta siempre: suele ir a otra impresora que el recibo.
          silent: !job.sheet && deviceName !== "",
          deviceName: job.sheet ? undefined : deviceName || undefined,
          printBackground: true,
          margins: { marginType: "none" },
          pageSize: { width: Math.round(job.width * MICRONS_PER_MM), height: Math.round(job.height * MICRONS_PER_MM) },
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
    if (!path.startsWith(documentsDir)) throw new TypeError("Archivo fuera de la carpeta de Ventamas.");
    shell.showItemInFolder(path);
  });
}
