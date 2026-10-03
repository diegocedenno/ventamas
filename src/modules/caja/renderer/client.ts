import { call } from "../../../renderer/src/lib/ipc";
import { CAJA, type CloseInput, type MoveInput, type OpenInput, type PaymentMethod, type SessionInfo, type SessionSummary } from "../api";

export const caja = {
  methods: () => call<PaymentMethod[]>(CAJA.methods),
  setMethodActive: (id: string, active: boolean) => call<PaymentMethod[]>(CAJA.setMethodActive, id, active),
  current: () => call<SessionSummary | null>(CAJA.current),
  open: (input: OpenInput) => call<SessionSummary>(CAJA.open, input),
  move: (input: MoveInput) => call<SessionSummary>(CAJA.move, input),
  close: (input: CloseInput) => call<SessionSummary>(CAJA.close, input),
  history: () => call<SessionInfo[]>(CAJA.history),
  summary: (id: string) => call<SessionSummary>(CAJA.summary, id),
};
