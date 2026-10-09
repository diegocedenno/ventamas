import { call } from "../../../renderer/src/lib/ipc";
import {
  INVENTARIO,
  type Category,
  type CategoryInput,
  type InventorySummary,
  type Product,
  type ProductFilter,
  type ProductInput,
  type ProductSummary,
  type RubroInfo,
  type SearchResult,
  type StockMoveInput,
  type StockMovement,
} from "../api";

export const inventario = {
  list: (filter: ProductFilter) => call<ProductSummary[]>(INVENTARIO.list, filter),
  get: (id: string) => call<Product>(INVENTARIO.get, id),
  save: (input: ProductInput) => call<Product>(INVENTARIO.save, input),
  setActive: (id: string, active: boolean) => call<void>(INVENTARIO.setActive, id, active),
  search: (query: string) => call<SearchResult>(INVENTARIO.search, query),
  browse: (categoryId: string | null) => call<Product[]>(INVENTARIO.browse, categoryId),
  summary: () => call<InventorySummary>(INVENTARIO.summary),
  suggestCode: (skip: string[]) => call<string>(INVENTARIO.suggestCode, skip),
  categories: (includeInactive = false) => call<Category[]>(INVENTARIO.categories, includeInactive),
  saveCategory: (input: CategoryInput) => call<Category[]>(INVENTARIO.saveCategory, input),
  rubros: () => call<RubroInfo[]>(INVENTARIO.rubros),
  loadRubro: (id: string) => call<{ added: number; categories: Category[] }>(INVENTARIO.loadRubro, id),
  move: (input: StockMoveInput) => call<Product>(INVENTARIO.move, input),
  movements: (productId: string) => call<StockMovement[]>(INVENTARIO.movements, productId),
};
