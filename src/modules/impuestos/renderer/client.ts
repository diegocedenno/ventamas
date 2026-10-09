import { call } from "../../../renderer/src/lib/ipc";
import { IMPUESTOS, type TaxClass, type TaxClassInput } from "../api";

export const impuestos = {
  list: () => call<TaxClass[]>(IMPUESTOS.list),
  save: (input: TaxClassInput) => call<TaxClass[]>(IMPUESTOS.save, input),
};
