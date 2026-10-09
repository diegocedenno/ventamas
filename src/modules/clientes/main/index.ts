import type { MainModule } from "../../../main/modules";
import { CLIENTES } from "../api";
import { manifest } from "../manifest";
import { getCustomer, listCustomers, saveCustomer, setCustomerActive } from "./customers";
import { migrations } from "./migrations";

export const clientesModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(CLIENTES.list, (query, includeInactive) => listCustomers(db, query, includeInactive));
    handle(CLIENTES.get, (id) => getCustomer(db, id));
    handle(CLIENTES.save, (input) => saveCustomer(db, input));
    handle(CLIENTES.setActive, (id, active) => setCustomerActive(db, id, active));
  },
};
