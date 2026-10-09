import type { MainModule } from "../../../main/modules";
import { NUCLEO } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { changeSetting, finishSetup } from "./settings";

export const nucleoModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(NUCLEO.setSetting, (key, value) => changeSetting(db, key, value));
    handle(NUCLEO.finishSetup, (input) => finishSetup(db, input));
  },
};
