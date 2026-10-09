// Contrato entre la interfaz y el proceso principal. La interfaz no toca la base de
// datos ni el sistema de archivos: todo pasa por canales con nombre ("ventas:crear").
// Cada módulo declara los suyos en su archivo api.ts.

import type { InvoicePaper, ReceiptWidth, Settings } from "./settings";

export interface AppInfo {
  version: string;
  /** Carpeta donde viven los datos de la tienda. */
  dataDir: string;
  electron: string;
}

export interface BootData {
  settings: Settings;
  info: AppInfo;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface VentamasApi {
  /** Estado inicial, disponible antes del primer pintado. */
  boot: BootData;
  /** Llama a una operación del proceso principal. Nunca rechaza: el fallo viene en el resultado. */
  invoke(channel: string, ...args: unknown[]): Promise<Result<unknown>>;
}

export const BOOT_CHANNEL = "app:boot";

/** Operaciones de la aplicación que no pertenecen a ningún módulo. */
export const APP = {
  openDataDir: "app:open-data-dir",
  printers: "app:printers",
  print: "app:print",
  savePdf: "app:save-pdf",
  showFile: "app:show-file",
} as const;

export interface PrinterInfo {
  name: string;
  displayName: string;
}

/** El rollo del recibo (por su ancho en milímetros) o una hoja. */
export type Paper = ReceiptWidth | InvoicePaper;

/** Lo que está en pantalla dentro de la zona de impresión, con su papel. */
export interface PrintJob {
  paper: Paper;
  /** Alto del contenido en milímetros. Solo cuenta en el rollo: una hoja tiene su tamaño. */
  height: number;
}

export interface PdfJob extends PrintJob {
  /** Nombre del archivo, sin carpeta ni extensión: "C01-000012". */
  name: string;
}

export const GENERIC_ERROR = "Algo salió mal y no se pudo completar. Inténtalo de nuevo.";
