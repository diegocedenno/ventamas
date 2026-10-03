import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { money } from "@shared/money";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import {
  addMovement,
  closeSession,
  currentSession,
  listMethods,
  listSessions,
  openSession,
  recordSaleMoney,
  requireOpenSession,
  sessionSummary,
  setMethodActive,
} from "./cash";
import { migrations } from "./migrations";

let db: Db;
const morning = new Date(2026, 9, 5, 8, 0);
const evening = new Date(2026, 9, 5, 18, 0);
const USD_RATE = 866_560_000;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "caja", migrations }]);
});

afterEach(() => db.close());

const open = () =>
  openSession(db, { floats: [{ methodId: "efectivo-usd", amount: 2000 }, { methodId: "efectivo-ves", amount: 0 }] }, morning);
const line = (summary: { totals: Array<{ method: { id: string } }> }, id: string) =>
  summary.totals.find((t) => t.method.id === id) as ReturnType<typeof sessionSummary>["totals"][number];

// La venta de referencia: 65 $, con 40 $ en efectivo y el resto por pago móvil.
function referenceSale(sessionId: string) {
  recordSaleMoney(
    db,
    sessionId,
    "venta-1",
    [
      { methodId: "efectivo-usd", kind: "cobro", amount: 4000, currency: "USD", rate: USD_RATE, baseAmount: 4000, baseCurrency: "USD", note: "" },
      { methodId: "pago-movil", kind: "cobro", amount: 2166400, currency: "VES", rate: null, baseAmount: 2500, baseCurrency: "USD", note: "4821" },
    ],
    "2026-10-05T14:00:00.000Z"
  );
}

describe("medios de pago", () => {
  it("vienen los siete habituales, cada uno con su moneda", () => {
    expect(listMethods(db).map((m) => [m.name, m.currency, m.kind])).toEqual([
      ["Bolívares efectivo", "VES", "efectivo"],
      ["Dólares efectivo", "USD", "efectivo"],
      ["Euros efectivo", "EUR", "efectivo"],
      ["Punto de venta", "VES", "electronico"],
      ["Pago móvil", "VES", "electronico"],
      ["Transferencia", "VES", "electronico"],
      ["Zelle", "USD", "electronico"],
    ]);
  });

  it("se pueden desactivar, pero no todos", () => {
    expect(setMethodActive(db, "efectivo-eur", false).find((m) => m.id === "efectivo-eur")?.active).toBe(false);
    for (const m of listMethods(db).filter((m) => m.active).slice(1)) setMethodActive(db, m.id, false);
    const last = listMethods(db).find((m) => m.active)!;
    expect(() => setMethodActive(db, last.id, false)).toThrow(/al menos un medio/);
    expect(() => setMethodActive(db, "bitcoin", false)).toThrow(UserError);
  });
});

describe("abrir la caja", () => {
  it("sin caja abierta no se mueve dinero", () => {
    expect(currentSession(db)).toBeNull();
    expect(() => requireOpenSession(db)).toThrow(/caja está cerrada/);
    expect(() => addMovement(db, { methodId: "efectivo-usd", kind: "salida", amount: 500, reason: "Almuerzo" })).toThrow(
      /caja está cerrada/
    );
  });

  it("abre con el fondo inicial de cada efectivo", () => {
    const summary = open();
    expect(summary.closedAt).toBeNull();
    expect(line(summary, "efectivo-usd")).toMatchObject({ opening: 2000, expected: 2000, counted: null });
    expect(line(summary, "efectivo-ves")).toMatchObject({ opening: 0, expected: 0 });
    expect(summary.totals).toHaveLength(7);
    expect(currentSession(db)?.id).toBe(summary.id);
  });

  it("no se puede abrir dos veces, ni con fondos raros", () => {
    open();
    expect(() => open()).toThrow(/ya está abierta/);
    closeSession(db, { counts: [{ methodId: "efectivo-usd", counted: 2000 }], note: "" }, evening);
    expect(() => openSession(db, { floats: [{ methodId: "efectivo-usd", amount: -1 }] })).toThrow(/negativo/);
    expect(() => openSession(db, { floats: [{ methodId: "pago-movil", amount: 100 }] })).toThrow(TypeError);
    setMethodActive(db, "efectivo-eur", false);
    expect(() => openSession(db, { floats: [{ methodId: "efectivo-eur", amount: 100 }] })).toThrow(/desactivado/);
    expect(currentSession(db)).toBeNull();
  });
});

describe("durante el día", () => {
  it("las entradas y salidas a mano cambian lo esperado", () => {
    open();
    addMovement(db, { methodId: "efectivo-usd", kind: "salida", amount: 500, reason: "Almuerzo" }, morning);
    const summary = addMovement(db, { methodId: "efectivo-usd", kind: "entrada", amount: 1000, reason: "Cambio de billetes" }, morning);
    expect(line(summary, "efectivo-usd")).toMatchObject({ opening: 2000, moves: 500, expected: 2500 });
  });

  it("una entrada o salida necesita monto y motivo", () => {
    open();
    expect(() => addMovement(db, { methodId: "efectivo-usd", kind: "salida", amount: 0, reason: "x" })).toThrow(/mayor que cero/);
    expect(() => addMovement(db, { methodId: "efectivo-usd", kind: "salida", amount: 100, reason: "  " })).toThrow(/Falta el motivo/);
    expect(() => addMovement(db, { methodId: "efectivo-usd", kind: "regalo", amount: 100, reason: "x" })).toThrow(TypeError);
  });

  it("los cobros y vueltos de las ventas suman a cada medio", () => {
    const { id } = open();
    referenceSale(id);
    // Otra venta de 18 $ pagada con un billete de 20 $: 2 $ de vuelto.
    recordSaleMoney(
      db,
      id,
      "venta-2",
      [
        { methodId: "efectivo-usd", kind: "cobro", amount: 2000, currency: "USD", rate: USD_RATE, baseAmount: 2000, baseCurrency: "USD", note: "" },
        { methodId: "efectivo-usd", kind: "vuelto", amount: -200, currency: "USD", rate: USD_RATE, baseAmount: -200, baseCurrency: "USD", note: "" },
      ],
      "2026-10-05T15:00:00.000Z"
    );

    const summary = sessionSummary(db, id);
    expect(line(summary, "efectivo-usd")).toMatchObject({ opening: 2000, sales: 6000, change: -200, expected: 7800 });
    expect(line(summary, "pago-movil")).toMatchObject({ sales: 2166400, expected: 2166400 });
    expect(summary.salesCount).toBe(2);
    expect(summary.salesTotals).toEqual([money(8300, "USD")]);
  });

  it("los movimientos de dinero no se pueden alterar", () => {
    open();
    expect(() => db.exec("UPDATE money_movements SET amount = 1")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM money_movements")).toThrow(/no se borran/);
  });
});

describe("cerrar la caja", () => {
  it("compara lo contado con lo esperado y guarda ambos", () => {
    const { id } = open();
    referenceSale(id);
    const closed = closeSession(
      db,
      { counts: [{ methodId: "efectivo-usd", counted: 5900 }, { methodId: "pago-movil", counted: 2166400 }], note: "Faltó 1 $" },
      evening
    );

    expect(closed.closedAt).toBe(evening.toISOString());
    expect(closed.note).toBe("Faltó 1 $");
    expect(line(closed, "efectivo-usd")).toMatchObject({ expected: 6000, counted: 5900 });
    expect(line(closed, "pago-movil")).toMatchObject({ expected: 2166400, counted: 2166400 });
    expect(line(closed, "zelle")).toMatchObject({ expected: 0, counted: null });
    expect(currentSession(db)).toBeNull();
  });

  it("exige contar todo lo que se movió", () => {
    const { id } = open();
    referenceSale(id);
    expect(() => closeSession(db, { counts: [{ methodId: "efectivo-usd", counted: 6000 }], note: "" })).toThrow(
      /Falta contar «Pago móvil»/
    );
    expect(() => closeSession(db, { counts: [{ methodId: "efectivo-usd", counted: -1 }], note: "" })).toThrow(/negativo/);
    expect(currentSession(db)?.id).toBe(id);
  });

  it("una caja cerrada no cambia, y se puede abrir otra", () => {
    const first = open();
    closeSession(db, { counts: [{ methodId: "efectivo-usd", counted: 2000 }], note: "" }, evening);
    expect(() => closeSession(db, { counts: [], note: "" })).toThrow(/caja está cerrada/);
    expect(() => db.exec("UPDATE cash_counts SET counted = 0")).toThrow(/no se modifican/);

    const second = openSession(db, { floats: [] }, new Date(2026, 9, 6, 8, 0));
    expect(second.id).not.toBe(first.id);
    expect(listSessions(db).map((s) => [s.id, s.closedAt !== null])).toEqual([
      [second.id, false],
      [first.id, true],
    ]);
    expect(line(sessionSummary(db, first.id), "efectivo-usd")).toMatchObject({ expected: 2000, counted: 2000 });
  });
});
