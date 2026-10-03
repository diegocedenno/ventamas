import type { MainModule } from "../../../main/modules";
import { readSettings } from "../../nucleo/main/settings";
import { VENTAS } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { createSale, getSale, salesOfSession } from "./sales";

export const ventasModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(VENTAS.create, (input) => createSale(db, input, readSettings(db)));
    handle(VENTAS.get, (id) => getSale(db, id));
    handle(VENTAS.ofSession, (sessionId) => salesOfSession(db, sessionId));
  },
};
