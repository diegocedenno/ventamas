import { call } from "../../../renderer/src/lib/ipc";
import {
  FACTURACION,
  type Book,
  type ControlLot,
  type Invoice,
  type InvoiceStatus,
  type IssueInput,
  type LotInput,
  type RecordInput,
} from "../api";

export const facturacion = {
  status: () => call<InvoiceStatus>(FACTURACION.status),
  saveLot: (input: LotInput) => call<ControlLot>(FACTURACION.saveLot, input),
  ofSale: (saleId: string) => call<Invoice | null>(FACTURACION.ofSale, saleId),
  issue: (input: IssueInput) => call<Invoice>(FACTURACION.issue, input),
  record: (input: RecordInput) => call<Invoice>(FACTURACION.record, input),
  void: (id: string, reason: string) => call<Invoice>(FACTURACION.void, id, reason),
  voidSheet: (control: string, reason: string) => call<string | null>(FACTURACION.voidSheet, control, reason),
  list: (month: string) => call<Book>(FACTURACION.list, month),
  exportBook: (month: string) => call<string>(FACTURACION.exportBook, month),
};
