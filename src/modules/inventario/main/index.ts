import type { MainModule } from "../../../main/modules";
import { readSettings } from "../../nucleo/main/settings";
import { INVENTARIO } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { getProduct, listProducts, saveProduct, searchForSale, setProductActive } from "./products";

export const inventarioModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(INVENTARIO.list, (query, includeInactive) => listProducts(db, query, includeInactive));
    handle(INVENTARIO.get, (id) => getProduct(db, id));
    // Los precios se guardan en la moneda de la tienda.
    handle(INVENTARIO.save, (input) => saveProduct(db, input, readSettings(db)["store.currency"]));
    handle(INVENTARIO.setActive, (id, active) => setProductActive(db, id, active));
    handle(INVENTARIO.search, (query) => searchForSale(db, query));
  },
};
