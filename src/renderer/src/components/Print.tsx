import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { APP, type PdfJob, type PrintJob } from "@shared/api";
import type { ReceiptWidth } from "@shared/settings";
import { call } from "../lib/ipc";

interface Printer {
  /** Imprime el documento en la impresora de recibos (o pregunta cuál si no hay una configurada). */
  print(document: ReactNode, width: ReceiptWidth): Promise<void>;
  /** Guarda el documento como PDF y devuelve la ruta del archivo. */
  savePdf(document: ReactNode, width: ReceiptWidth, name: string): Promise<string>;
}

const PrintContext = createContext<Printer | null>(null);

const PX_PER_MM = 96 / 25.4;

/**
 * Zona de impresión: el documento se dibuja fuera de la pantalla, se mide y se manda a
 * imprimir. La hoja de estilos de impresión oculta la aplicación y deja solo esta zona.
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<{ document: ReactNode; width: ReceiptWidth } | null>(null);
  const zone = useRef<HTMLDivElement>(null);

  const run = useCallback(async <T,>(document: ReactNode, width: ReceiptWidth, send: (job: PrintJob) => Promise<T>) => {
    flushSync(() => setJob({ document, width }));
    try {
      await window.document.fonts.ready;
      const height = Math.ceil((zone.current?.getBoundingClientRect().height ?? 0) / PX_PER_MM) + 4;
      return await send({ width, height });
    } finally {
      setJob(null);
    }
  }, []);

  const printer = useMemo<Printer>(
    () => ({
      print: (document, width) => run(document, width, (size) => call<void>(APP.print, size)),
      savePdf: (document, width, name) =>
        run(document, width, (size) => call<string>(APP.savePdf, { ...size, name } satisfies PdfJob)),
    }),
    [run]
  );

  return (
    <PrintContext.Provider value={printer}>
      {children}
      {createPortal(
        <div className="print-zone" ref={zone} style={{ width: `${job?.width ?? 80}mm` }} aria-hidden="true">
          {job?.document}
        </div>,
        document.body
      )}
    </PrintContext.Provider>
  );
}

export function usePrint(): Printer {
  const printer = useContext(PrintContext);
  if (!printer) throw new Error("usePrint debe usarse dentro de PrintProvider");
  return printer;
}
