import { call } from "../../../renderer/src/lib/ipc";
import { CLIENTES, type Customer, type CustomerInput } from "../api";

export const clientes = {
  list: (query: string, includeInactive = false) => call<Customer[]>(CLIENTES.list, query, includeInactive),
  get: (id: string) => call<Customer>(CLIENTES.get, id),
  save: (input: CustomerInput) => call<Customer>(CLIENTES.save, input),
  setActive: (id: string, active: boolean) => call<Customer>(CLIENTES.setActive, id, active),
};
