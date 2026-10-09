import type { MainModule } from "../../../main/modules";
import { IMPUESTOS } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { listTaxClasses, saveTaxClass } from "./taxes";

export const impuestosModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(IMPUESTOS.list, () => listTaxClasses(db));
    handle(IMPUESTOS.save, (input) => saveTaxClass(db, input));
  },
};
