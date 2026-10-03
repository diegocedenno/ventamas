import { CURRENCIES, format, money, type CurrencyCode } from "@shared/money";

const LOCALE = "es-VE";

/** "$ 65,00" a partir del monto en unidad mínima. */
export function formatMoney(amount: number, currency: CurrencyCode): string {
  return format(money(amount, currency), LOCALE);
}

/** "65,00": el monto sin símbolo, para precargar un campo. */
export function plainAmount(amount: number, currency: CurrencyCode): string {
  const decimals = CURRENCIES[currency].decimals;
  return new Intl.NumberFormat(LOCALE, { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: false }).format(
    amount / 10 ** decimals
  );
}

const dateTime = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium", timeStyle: "short" });
const time = new Intl.DateTimeFormat(LOCALE, { timeStyle: "short" });
const day = new Intl.DateTimeFormat(LOCALE, { dateStyle: "medium" });

/** "5 oct 2026, 2:05 p. m." */
export const formatDateTime = (iso: string): string => dateTime.format(new Date(iso));

/** "2:05 p. m." */
export const formatTime = (iso: string): string => time.format(new Date(iso));

/** "5 oct 2026", a partir de una fecha ISO o de un día "AAAA-MM-DD". */
export function formatDay(value: string): string {
  // Un día sin hora se interpreta en la zona del equipo, no en UTC.
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return day.format(date);
}

/** "1 pieza", "3 piezas" */
export function plural(count: number, one: string, many: string): string {
  return `${new Intl.NumberFormat(LOCALE).format(count)} ${count === 1 ? one : many}`;
}
