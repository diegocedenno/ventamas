import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { UserError } from "@shared/errors";
import type { MainModule } from "../../../main/modules";
import { readSettings } from "../../nucleo/main/settings";
import { FACTURACION } from "../api";
import { manifest } from "../manifest";
import { bookCsv, invoiceOfSale, invoiceStatus, issueInvoice, recordExternal, salesBook, saveLot, voidInvoice, voidSheet } from "./invoices";
import { migrations } from "./migrations";

export const facturacionModule: MainModule = {
  manifest,
  migrations,
  register({ db, documentsDir, handle }) {
    handle(FACTURACION.status, () => invoiceStatus(db, readSettings(db)));
    handle(FACTURACION.saveLot, (input) => saveLot(db, input));
    handle(FACTURACION.ofSale, (saleId) => invoiceOfSale(db, saleId));
    handle(FACTURACION.issue, (input) => issueInvoice(db, input, readSettings(db)));
    handle(FACTURACION.record, (input) => recordExternal(db, input, readSettings(db)));
    handle(FACTURACION.void, (id, reason) => voidInvoice(db, id, reason));
    handle(FACTURACION.voidSheet, (control, reason) => voidSheet(db, control, reason));
    handle(FACTURACION.list, (month) => salesBook(db, month));
    handle(FACTURACION.exportBook, (month): string => {
      const book = salesBook(db, month);
      const dir = join(documentsDir, process.env.VENTAMAS_DATA_DIR ? "libros" : "Libros");
      const file = join(dir, `auxiliar-libro-de-ventas-${book.month}.csv`);
      try {
        mkdirSync(dir, { recursive: true });
        writeFileSync(file, bookCsv(book));
      } catch {
        throw new UserError("No se pudo guardar el archivo. Si lo tienes abierto en otro programa, ciérralo e inténtalo de nuevo.");
      }
      return file;
    });
  },
};
