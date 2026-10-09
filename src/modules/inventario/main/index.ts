import type { MainModule } from "../../../main/modules";
import { findTaxClass } from "../../impuestos/main/taxes";
import { readSettings } from "../../nucleo/main/settings";
import { INVENTARIO } from "../api";
import { manifest } from "../manifest";
import { listCategories, listRubros, loadRubro, saveCategory } from "./categories";
import { migrations } from "./migrations";
import { browseForSale, getProduct, listProducts, saveProduct, searchForSale, setProductActive } from "./products";
import { inventorySummary, listMovements, moveStock, suggestCode } from "./stock";

export const inventarioModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(INVENTARIO.list, (filter) => listProducts(db, filter));
    handle(INVENTARIO.get, (id) => getProduct(db, id));
    // Los precios se guardan en la moneda de la tienda.
    handle(INVENTARIO.save, (input) =>
      saveProduct(db, input, {
        currency: readSettings(db)["store.currency"],
        isTaxClass: (id) => findTaxClass(db, id) !== undefined,
      })
    );
    handle(INVENTARIO.setActive, (id, active) => setProductActive(db, id, active));
    handle(INVENTARIO.search, (query) => searchForSale(db, query));
    handle(INVENTARIO.browse, (categoryId) => browseForSale(db, categoryId));
    handle(INVENTARIO.summary, () => inventorySummary(db, readSettings(db)["store.currency"]));
    handle(INVENTARIO.suggestCode, (skip) => suggestCode(db, skip));
    handle(INVENTARIO.categories, (includeInactive) => listCategories(db, includeInactive));
    handle(INVENTARIO.saveCategory, (input) => saveCategory(db, input));
    handle(INVENTARIO.rubros, () => listRubros(db));
    handle(INVENTARIO.loadRubro, (id) => loadRubro(db, id));
    handle(INVENTARIO.move, (input) => moveStock(db, input));
    handle(INVENTARIO.movements, (productId) => listMovements(db, productId));
  },
};
