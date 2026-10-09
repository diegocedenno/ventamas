import { call } from "../../../renderer/src/lib/ipc";
import {
  VENTAS,
  type ParkedInfo,
  type ParkInput,
  type ResumedSale,
  type Sale,
  type SaleFilter,
  type SaleInfo,
  type SaleInput,
  type SalesPage,
} from "../api";

export const ventas = {
  create: (input: SaleInput) => call<Sale>(VENTAS.create, input),
  get: (id: string) => call<Sale>(VENTAS.get, id),
  ofSession: (sessionId: string) => call<SaleInfo[]>(VENTAS.ofSession, sessionId),
  list: (filter: SaleFilter) => call<SalesPage>(VENTAS.list, filter),
  park: (input: ParkInput) => call<ParkedInfo[]>(VENTAS.park, input),
  parked: () => call<ParkedInfo[]>(VENTAS.parked),
  takeParked: (id: string) => call<ResumedSale>(VENTAS.takeParked, id),
  discardParked: (id: string) => call<ParkedInfo[]>(VENTAS.discardParked, id),
};
