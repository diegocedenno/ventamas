import type { CurrencyCode } from "@shared/money";
import type { ThemeId } from "@shared/themes";

export const NUCLEO = {
  setSetting: "settings:set",
  finishSetup: "settings:finish-setup",
} as const;

/** Lo que se elige en el asistente de bienvenida. */
export interface SetupInput {
  storeName: string;
  currency: CurrencyCode;
  theme: ThemeId;
}
