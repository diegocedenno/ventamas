import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { convert, money } from "@shared/money";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { migrations } from "./migrations";
import { fetchOfficialRates, getRatesState, rateHistory, rateTable, saveRates } from "./rates";

let db: Db;
const monday = new Date(2026, 9, 5, 9, 0);
const tuesday = new Date(2026, 9, 6, 8, 30);

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "monedas", migrations }]);
});

afterEach(() => db.close());

const input = (usd: number, eur: number, source = "manual") => ({ rates: { USD: usd, EUR: eur }, source });

describe("tasas", () => {
  it("una tienda nueva no tiene tasas y no puede vender", () => {
    const state = getRatesState(db, monday);
    expect(state).toEqual({ pivot: "VES", today: "2026-10-05", rates: {}, confirmedToday: false });
  });

  it("al confirmarlas quedan vigentes para ese día", () => {
    const state = saveRates(db, input(866_560_000, 973_928_133), monday);
    expect(state.confirmedToday).toBe(true);
    expect(state.rates.USD).toMatchObject({ rate: 866_560_000, source: "manual", day: "2026-10-05" });
    expect(convert(money(6500, "USD"), "VES", rateTable(state))).toEqual(money(5632640, "VES"));
  });

  it("al día siguiente siguen ahí, pero hay que confirmarlas de nuevo", () => {
    saveRates(db, input(866_560_000, 973_928_133), monday);
    const next = getRatesState(db, tuesday);
    expect(next.confirmedToday).toBe(false);
    expect(next.rates.USD?.rate).toBe(866_560_000);

    expect(saveRates(db, input(870_000_000, 978_000_000, "bcv"), tuesday).confirmedToday).toBe(true);
    expect(getRatesState(db, tuesday).rates.USD).toMatchObject({ rate: 870_000_000, source: "bcv", day: "2026-10-06" });
  });

  it("cada confirmación queda en el historial y no se puede alterar", () => {
    saveRates(db, input(866_560_000, 973_928_133), monday);
    saveRates(db, input(870_000_000, 978_000_000), tuesday);
    expect(rateHistory(db)).toHaveLength(4);
    expect(rateHistory(db)[0]?.day).toBe("2026-10-06");
    expect(() => db.exec("UPDATE exchange_rates SET rate = 1")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM exchange_rates")).toThrow(/no se borran/);
  });

  it("rechaza tasas faltantes, en cero o absurdas", () => {
    expect(() => saveRates(db, { rates: { USD: 866_560_000 }, source: "manual" }, monday)).toThrow(/tasa del euro/);
    expect(() => saveRates(db, input(0, 973_928_133), monday)).toThrow(UserError);
    expect(() => saveRates(db, input(866.56, 973_928_133), monday)).toThrow(UserError);
    expect(() => saveRates(db, input(866_560_000, Number.MAX_SAFE_INTEGER), monday)).toThrow(/demasiado alta/);
    expect(getRatesState(db, monday).rates).toEqual({});
  });
});

describe("tasa oficial", () => {
  const reply = (body: unknown, ok = true) => async () => ({ ok, json: async () => body });
  const sample = [
    { moneda: "USD", fuente: "oficial", promedio: 866.5612, fechaActualizacion: "2026-10-02T00:00:00-04:00" },
    { moneda: "EUR", fuente: "oficial", promedio: 973.92813268, fechaActualizacion: "2026-10-02T00:00:00-04:00" },
    { moneda: "USD", fuente: "paralelo", promedio: 974.41, fechaActualizacion: "2026-10-03T18:01:13.149Z" },
  ];

  it("toma solo la tasa oficial de cada moneda y la redondea a seis decimales", async () => {
    expect(await fetchOfficialRates(reply(sample))).toEqual({
      rates: { USD: 866_561_200, EUR: 973_928_133 },
      date: "2026-10-02",
    });
  });

  it("sin internet o con una respuesta rara, pide escribirla a mano", async () => {
    const offline = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(fetchOfficialRates(offline)).rejects.toThrow(UserError);
    await expect(fetchOfficialRates(reply(sample, false))).rejects.toThrow(/a mano/);
    await expect(fetchOfficialRates(reply({ error: true }))).rejects.toThrow(UserError);
    await expect(fetchOfficialRates(reply(sample.slice(0, 1)))).rejects.toThrow(UserError);
    await expect(fetchOfficialRates(reply([{ moneda: "USD", fuente: "oficial", promedio: "caro" }]))).rejects.toThrow(
      UserError
    );
  });
});
