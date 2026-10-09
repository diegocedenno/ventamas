import type { MainModule } from "../../../main/modules";
import { readSettings } from "../../nucleo/main/settings";
import { VENTAS } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { discardParked, listParked, parkSale, takeParked } from "./parked";
import { createSale, getSale, listSales, salesOfSession } from "./sales";

export const ventasModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(VENTAS.create, (input) => createSale(db, input, readSettings(db)));
    handle(VENTAS.get, (id) => getSale(db, id));
    handle(VENTAS.ofSession, (sessionId) => salesOfSession(db, sessionId));
    handle(VENTAS.list, (filter) => listSales(db, filter));
    handle(VENTAS.park, (input) => parkSale(db, input));
    handle(VENTAS.parked, () => listParked(db));
    handle(VENTAS.takeParked, (id) => takeParked(db, id));
    handle(VENTAS.discardParked, (id) => discardParked(db, id));
  },
};
