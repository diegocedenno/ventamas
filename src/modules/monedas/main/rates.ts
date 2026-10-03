import { randomUUID } from "node:crypto";
import { UserError } from "@shared/errors";
import { CURRENCIES, RATE_SCALE, type CurrencyCode, type RateTable } from "@shared/money";
import { asObject } from "@shared/validate";
import { transaction, type Db } from "../../../main/db/database";
import { localDay } from "../../../main/db/facts";
import { FOREIGN, PIVOT, type OfficialRates, type RateInfo, type RatesInput, type RatesState, type RateSource } from "../api";

interface RateRow {
  currency: string;
  rate: number;
  source: string;
  day: string;
  created_at: string;
}

const toInfo = (row: RateRow): RateInfo => ({
  currency: row.currency as CurrencyCode,
  rate: row.rate,
  source: row.source as RateSource,
  day: row.day,
  createdAt: row.created_at,
});

export function getRatesState(db: Db, now = new Date()): RatesState {
  const today = localDay(now);
  const latest = db.prepare(
    "SELECT currency, rate, source, day, created_at FROM exchange_rates WHERE currency = ? ORDER BY created_at DESC, rowid DESC LIMIT 1"
  );
  const rates: RatesState["rates"] = {};
  for (const currency of FOREIGN) {
    const row = latest.get(currency) as RateRow | undefined;
    if (row) rates[currency] = toInfo(row);
  }
  const confirmedToday = FOREIGN.every((currency) => rates[currency]?.day === today);
  return { pivot: PIVOT, today, rates, confirmedToday };
}

/** Las tasas vigentes en la forma que usa la conversión de dinero. */
export function rateTable(state: RatesState): RateTable {
  const rates: RateTable["rates"] = {};
  for (const currency of FOREIGN) {
    const info = state.rates[currency];
    if (info) rates[currency] = info.rate;
  }
  return { pivot: state.pivot, rates };
}

// Una tasa de más de mil millones por unidad es, casi seguro, un error de tecleo.
const MAX_RATE = 1_000_000_000 * RATE_SCALE;

/** Confirma las tasas del día. Siempre registra todas las monedas, aunque alguna no haya cambiado. */
export function saveRates(db: Db, value: unknown, now = new Date()): RatesState {
  const input = asObject(value, "tasas") as unknown as RatesInput;
  const given = asObject(input.rates, "tasas");
  if (input.source !== "manual" && input.source !== "bcv") throw new TypeError("Origen de tasa no válido.");

  const clean = FOREIGN.map((currency) => {
    const rate = given[currency];
    const name = CURRENCIES[currency].name.toLowerCase();
    if (typeof rate !== "number" || !Number.isSafeInteger(rate) || rate <= 0) {
      throw new UserError(`Falta la tasa del ${name}.`);
    }
    if (rate > MAX_RATE) throw new UserError(`La tasa del ${name} es demasiado alta. Revisa el número.`);
    return { currency, rate };
  });

  const insert = db.prepare(
    "INSERT INTO exchange_rates (id, currency, rate, source, day, created_at) VALUES (?, ?, ?, ?, ?, ?)"
  );
  transaction(db, () => {
    for (const { currency, rate } of clean) {
      insert.run(randomUUID(), currency, rate, input.source, localDay(now), now.toISOString());
    }
  });
  return getRatesState(db, now);
}

export function rateHistory(db: Db, limit = 60): RateInfo[] {
  const rows = db
    .prepare("SELECT currency, rate, source, day, created_at FROM exchange_rates ORDER BY created_at DESC, rowid DESC LIMIT ?")
    .all(limit) as unknown as RateRow[];
  return rows.map(toInfo);
}

const OFFICIAL_URL = "https://ve.dolarapi.com/v1/cotizaciones";

type Fetch = (url: string, init?: { signal?: AbortSignal }) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

/**
 * Trae la tasa oficial del BCV desde DolarApi, un servicio comunitario (no es del BCV).
 * Solo propone valores: quien los confirma es el dueño.
 */
export async function fetchOfficialRates(fetcher: Fetch = fetch): Promise<OfficialRates> {
  const unavailable = new UserError(
    "No se pudo traer la tasa oficial. Revisa la conexión a internet o escribe la tasa a mano."
  );
  let body: unknown;
  try {
    const response = await fetcher(OFFICIAL_URL, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw unavailable;
    body = await response.json();
  } catch {
    throw unavailable;
  }
  if (!Array.isArray(body)) throw unavailable;

  const rates: OfficialRates["rates"] = {};
  let date = "";
  for (const item of body as Array<Record<string, unknown>>) {
    if (typeof item !== "object" || item === null || item.fuente !== "oficial") continue;
    const currency = FOREIGN.find((code) => code === item.moneda);
    const value = item.promedio;
    if (!currency || typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    rates[currency] = Math.round(value * RATE_SCALE);
    if (typeof item.fechaActualizacion === "string") date = item.fechaActualizacion.slice(0, 10);
  }
  if (!FOREIGN.every((currency) => rates[currency])) throw unavailable;
  return { rates, date };
}
