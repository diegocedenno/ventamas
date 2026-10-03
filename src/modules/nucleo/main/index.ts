import type { MainModule } from "../../../main/modules";
import { NUCLEO } from "../api";
import { manifest } from "../manifest";
import { migrations } from "./migrations";
import { writeSetting } from "./settings";

export const nucleoModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(NUCLEO.setSetting, (key, value) => writeSetting(db, key, value));
  },
};
