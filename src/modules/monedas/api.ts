import type { CurrencyCode } from "@shared/money";

export const MONEDAS = {
  state: "monedas:state",
  save: "monedas:save",
  fetchOfficial: "monedas:fetch-official",
  history: "monedas:history",
} as const;

/** Moneda en la que se expresan las tasas: la moneda local. */
export const PIVOT: CurrencyCode = "VES";

/** Monedas que necesitan tasa frente a la moneda local. */
export const FOREIGN: readonly CurrencyCode[] = ["USD", "EUR"];

export type RateSource = "manual" | "bcv";

export interface RateInfo {
  currency: CurrencyCode;
  /** Unidades de moneda local por una unidad de esta moneda, escaladas por RATE_SCALE. */
  rate: number;
  source: RateSource;
  /** Día de la tienda (AAAA-MM-DD) en que se confirmó. */
  day: string;
  createdAt: string;
}

export interface RatesState {
  pivot: CurrencyCode;
  today: string;
  /** Última tasa confirmada de cada moneda; falta la que nunca se ha cargado. */
  rates: Partial<Record<CurrencyCode, RateInfo>>;
  /** Todas las monedas tienen tasa confirmada hoy: se puede vender. */
  confirmedToday: boolean;
}

export interface RatesInput {
  rates: Partial<Record<CurrencyCode, number>>;
  source: RateSource;
}

export interface OfficialRates {
  rates: Partial<Record<CurrencyCode, number>>;
  /** Fecha que informa la fuente para esas tasas. */
  date: string;
}
