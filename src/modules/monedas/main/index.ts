import type { MainModule } from "../../../main/modules";
import { MONEDAS } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { fetchOfficialRates, getRatesState, rateHistory, saveRates } from "./rates";

export const monedasModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(MONEDAS.state, () => getRatesState(db));
    handle(MONEDAS.save, (input) => saveRates(db, input));
    handle(MONEDAS.fetchOfficial, () => fetchOfficialRates());
    handle(MONEDAS.history, () => rateHistory(db));
  },
};
