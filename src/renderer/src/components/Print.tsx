import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal, flushSync } from "react-dom";
import { APP, type Paper, type PdfJob, type PrintJob } from "@shared/api";
import { call } from "../lib/ipc";

interface Printer {
  /**
   * Imprime el documento. Un recibo va a la impresora de recibos (o pregunta cuál si no
   * hay una configurada); una hoja pregunta siempre.
   */
  print(document: ReactNode, paper: Paper): Promise<void>;
  /** Guarda el documento como PDF y devuelve la ruta del archivo. */
  savePdf(document: ReactNode, paper: Paper, name: string): Promise<string>;
}

const PrintContext = createContext<Printer | null>(null);

const PX_PER_MM = 96 / 25.4;
const SHEET_WIDTH_MM = 215.9;

/** Ancho de la zona de impresión, en milímetros: el del rollo o el de la hoja. */
const widthOf = (paper: Paper): number => (typeof paper === "number" ? paper : SHEET_WIDTH_MM);

/**
 * Zona de impresión: el documento se dibuja fuera de la pantalla, se mide y se manda a
 * imprimir. La hoja de estilos de impresión oculta la aplicación y deja solo esta zona.
 */
export function PrintProvider({ children }: { children: ReactNode }) {
  const [job, setJob] = useState<{ document: ReactNode; paper: Paper } | null>(null);
  const zone = useRef<HTMLDivElement>(null);

  const run = useCallback(async <T,>(document: ReactNode, paper: Paper, send: (job: PrintJob) => Promise<T>) => {
    flushSync(() => setJob({ document, paper }));
    try {
      await window.document.fonts.ready;
      const height = Math.ceil((zone.current?.getBoundingClientRect().height ?? 0) / PX_PER_MM) + 4;
      return await send({ paper, height });
    } finally {
      setJob(null);
    }
  }, []);

  const printer = useMemo<Printer>(
    () => ({
      print: (document, paper) => run(document, paper, (size) => call<void>(APP.print, size)),
      savePdf: (document, paper, name) => run(document, paper, (size) => call<string>(APP.savePdf, { ...size, name } satisfies PdfJob)),
    }),
    [run]
  );

  return (
    <PrintContext.Provider value={printer}>
      {children}
      {createPortal(
        <div className="print-zone" ref={zone} style={{ width: `${widthOf(job?.paper ?? 80)}mm` }} aria-hidden="true">
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
