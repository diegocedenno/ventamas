import type { MainModule } from "../../../main/modules";
import { CAJA } from "../api";
import { manifest } from "../manifest";
import {
  addMovement,
  closeSession,
  currentSession,
  listMethods,
  listSessions,
  openSession,
  sessionSummary,
  setMethodActive,
} from "./cash";
import { migrations } from "./migrations";

export const cajaModule: MainModule = {
  manifest,
  migrations,
  register({ db, handle }) {
    handle(CAJA.methods, () => listMethods(db));
    handle(CAJA.setMethodActive, (id, active) => setMethodActive(db, id, active));
    handle(CAJA.current, () => currentSession(db));
    handle(CAJA.open, (input) => openSession(db, input));
    handle(CAJA.move, (input) => addMovement(db, input));
    handle(CAJA.close, (input) => closeSession(db, input));
    handle(CAJA.history, () => listSessions(db));
    handle(CAJA.summary, (id) => sessionSummary(db, id));
  },
};
