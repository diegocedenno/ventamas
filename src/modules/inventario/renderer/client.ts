import { call } from "../../../renderer/src/lib/ipc";
import { INVENTARIO, type Product, type ProductInput, type ProductSummary, type SearchResult } from "../api";

export const inventario = {
  list: (query: string, includeInactive: boolean) => call<ProductSummary[]>(INVENTARIO.list, query, includeInactive),
  get: (id: string) => call<Product>(INVENTARIO.get, id),
  save: (input: ProductInput) => call<Product>(INVENTARIO.save, input),
  setActive: (id: string, active: boolean) => call<void>(INVENTARIO.setActive, id, active),
  search: (query: string) => call<SearchResult>(INVENTARIO.search, query),
};
