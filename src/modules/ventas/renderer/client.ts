import { call } from "../../../renderer/src/lib/ipc";
import { VENTAS, type Sale, type SaleInfo, type SaleInput } from "../api";

export const ventas = {
  create: (input: SaleInput) => call<Sale>(VENTAS.create, input),
  get: (id: string) => call<Sale>(VENTAS.get, id),
  ofSession: (sessionId: string) => call<SaleInfo[]>(VENTAS.ofSession, sessionId),
};
