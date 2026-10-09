export const IMPUESTOS = {
  list: "impuestos:list",
  save: "impuestos:save",
} as const;

export const TAX_NAME_MAX = 30;
export const TAX_CODE_MAX = 3;
/** Tasas en centésimas de punto: 1600 = 16 %. */
export const TAX_RATE_MAX = 10_000;

/** Una tasa de impuesto que puede llevar un producto. */
export interface TaxClass {
  id: string;
  name: string;
  /** Letra con la que se marca en recibos y facturas: G, R, E. */
  code: string;
  /** En centésimas de punto: 1600 = 16 %. */
  rate: number;
  active: boolean;
}

export interface TaxClassInput {
  /** Presente al editar una tasa que ya existe. */
  id?: string;
  name: string;
  code: string;
  rate: number;
  active: boolean;
}

/** La tasa que llevan los productos mientras no se elija otra. */
export const DEFAULT_TAX_CLASS = "general";

/** "16 %", "8 %", "12,5 %" */
export function formatTaxRate(rate: number, locale = "es-VE"): string {
  return `${new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(rate / 100)} %`;
}
