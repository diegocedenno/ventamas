import { call } from "../../../renderer/src/lib/ipc";
import { MONEDAS, type OfficialRates, type RateInfo, type RatesInput, type RatesState } from "../api";

export const monedas = {
  state: () => call<RatesState>(MONEDAS.state),
  save: (input: RatesInput) => call<RatesState>(MONEDAS.save, input),
  fetchOfficial: () => call<OfficialRates>(MONEDAS.fetchOfficial),
  history: () => call<RateInfo[]>(MONEDAS.history),
};
