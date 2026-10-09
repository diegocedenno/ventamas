import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { openSession } from "../../caja/main/cash";
import type { ProductInput } from "../../inventario/api";
import { saveProduct } from "../../inventario/main/products";
import { saveRates } from "../../monedas/main/rates";
import { mainModules } from "../../registry.main";
import type { Sale } from "../../ventas/api";
import { createSale, type SaleSettings } from "../../ventas/main/sales";
import { formatControl, formatInvoiceDate, formatInvoiceNumber, type IssueInput } from "../api";
import {
  bookCsv,
  invoiceOfSale,
  invoiceStatus,
  issueInvoice,
  recordExternal,
  salesBook,
  saveLot,
  voidInvoice,
  voidSheet,
  type InvoiceSettings,
} from "./invoices";

let db: Db;
let shoeId: string;
let bookId: string;

const morning = new Date(2026, 9, 5, 8, 0);
const noon = new Date(2026, 9, 5, 12, 0);

const settings: InvoiceSettings = {
  "invoice.mode": "forma-libre",
  "invoice.regime": "ordinario",
  "invoice.series": "A",
  "invoice.start": 1,
  "store.name": "Calzados Altamira",
  "store.legalName": "Inversiones Altamira, C.A.",
  "store.taxId": "J-00124134-5",
  "store.address": "Av. Principal de Chacao, local 4, Caracas",
  "store.phone": "0212 555 00 11",
  "tax.enabled": true,
};
const saleSettings: SaleSettings = { "store.currency": "USD", "device.prefix": "C01", "tax.enabled": true, "tax.included": true };

const item = (name: string, price: number, taxClass: string): ProductInput => ({
  name,
  kind: "producto",
  category: "",
  price,
  cost: null,
  option1: "",
  option2: "",
  minStock: null,
  openPrice: false,
  taxClass,
  variants: [{ value1: "", value2: "", code: "", stock: 20, price: null, cost: null }],
});

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(
    db,
    mainModules.map((m) => ({ module: m.manifest.id, migrations: m.migrations }))
  );
  // Tasa redonda para que las cuentas en bolívares se sigan a mano: 1 $ = 100 Bs.
  saveRates(db, { rates: { USD: 100_000_000, EUR: 110_000_000 }, source: "manual" }, morning);
  shoeId = saveProduct(db, item("Zapato", 11600, "general"), { currency: "USD" }, morning).variants[0]!.id;
  bookId = saveProduct(db, item("Libro", 5000, "exento"), { currency: "USD" }, morning).variants[0]!.id;
  openSession(db, { floats: [] }, morning);
});

afterEach(() => db.close());

function sell(lines: Array<[string, number]>, at = noon, config = saleSettings): Sale {
  const total = lines.reduce((sum, [variantId, quantity]) => sum + (variantId === shoeId ? 11600 : 5000) * quantity, 0);
  return createSale(
    db,
    {
      lines: lines.map(([variantId, quantity]) => ({ variantId, quantity, discount: 0 })),
      discount: null,
      customerId: null,
      note: "",
      payments: [{ methodId: "efectivo-usd", amount: total, note: "" }],
      change: [],
      expectedTotal: total,
    },
    config,
    at
  );
}

const lot = () => saveLot(db, { prefix: "00", first: 101, last: 105, printer: "Imprenta Caracas, C.A." }, morning);
const maria = { name: "María Pérez", doc: "v12345678", address: "Chacao, Caracas", phone: "0414 555 12 34" };
const issue = (saleId: string, overrides: Partial<IssueInput> = {}, config = settings, at = noon) =>
  issueInvoice(db, { saleId, customer: maria, control: invoiceStatus(db, config).nextControl ?? "", ...overrides }, config, at);

describe("formatos", () => {
  it("escribe números de factura, de control y fechas como van en el papel", () => {
    expect(formatInvoiceNumber("A", 12)).toBe("A-00000012");
    expect(formatInvoiceNumber("", 12)).toBe("00000012");
    expect(formatControl("00", 1234)).toBe("00-00001234");
    expect(formatControl("", 7)).toBe("00000007");
    expect(formatInvoiceDate("2026-10-05")).toBe("05/10/2026");
  });
});

describe("qué falta para facturar", () => {
  it("una tienda sin configurar lista todo lo que falta", () => {
    const empty: InvoiceSettings = { ...settings, "store.name": "", "store.legalName": "", "store.taxId": "", "store.address": "", "tax.enabled": false };
    expect(invoiceStatus(db, empty).missing).toEqual([
      "el nombre o la razón social de la tienda",
      "el RIF de la tienda",
      "la dirección de la tienda (su domicilio fiscal)",
      "activar el desglose de impuestos",
      "registrar el lote de formas libres",
    ]);
  });

  it("con los datos y un lote, todo listo: dice el número y la hoja que tocan", () => {
    lot();
    expect(invoiceStatus(db, settings)).toMatchObject({ mode: "forma-libre", nextNumber: "A-00000001", nextControl: "00-00000101", remaining: 5, missing: [] });
  });

  it("un contribuyente formal no necesita desglosar impuestos", () => {
    lot();
    expect(invoiceStatus(db, { ...settings, "invoice.regime": "formal", "tax.enabled": false }).missing).toEqual([]);
  });

  it("con la facturación apagada o anotando facturas de otro medio no falta nada", () => {
    expect(invoiceStatus(db, { ...settings, "invoice.mode": "off" }).missing).toEqual([]);
    expect(invoiceStatus(db, { ...settings, "invoice.mode": "externa", "store.taxId": "" }).missing).toEqual([]);
  });
});

describe("lotes de formas libres", () => {
  it("registra un lote y lo deja en uso", () => {
    expect(lot()).toMatchObject({ prefix: "00", first: 101, last: 105, printer: "Imprenta Caracas, C.A." });
    const second = saveLot(db, { prefix: "00", first: 106, last: 200, printer: "" }, noon);
    expect(invoiceStatus(db, settings).lot?.id).toBe(second.id);
  });

  it("rechaza rangos imposibles o que se cruzan con otro lote", () => {
    lot();
    expect(() => saveLot(db, { prefix: "00", first: 105, last: 300, printer: "" })).toThrow(/se cruza/);
    expect(() => saveLot(db, { prefix: "00", first: 50, last: 10, printer: "" })).toThrow(/menor que el primero/);
    expect(() => saveLot(db, { prefix: "00", first: 0, last: 10, printer: "" })).toThrow(UserError);
    expect(() => saveLot(db, { prefix: "AB", first: 1, last: 10, printer: "" })).toThrow(/identificador/);
    // Otro identificador es otra numeración: no se cruza.
    expect(saveLot(db, { prefix: "01", first: 101, last: 105, printer: "" })).toMatchObject({ prefix: "01" });
  });
});

describe("emitir una factura", () => {
  beforeEach(() => {
    lot();
  });

  it("toma el siguiente número y la siguiente hoja, y guarda los datos tal como salieron", () => {
    const sale = sell([[shoeId, 1]]);
    const invoice = issue(sale.id);
    expect(invoice).toMatchObject({
      kind: "emitida",
      saleId: sale.id,
      number: "A-00000001",
      control: "00-00000101",
      customer: { name: "María Pérez", doc: "V-12345678", address: "Chacao, Caracas", phone: "0414 555 12 34" },
      issuer: { name: "Inversiones Altamira, C.A.", taxId: "J-00124134-5", address: "Av. Principal de Chacao, local 4, Caracas", regime: "ordinario" },
      issuedOn: "2026-10-05",
      voided: null,
    });
    expect(invoiceOfSale(db, sale.id)).toEqual(invoice);
    expect(invoiceStatus(db, settings)).toMatchObject({ nextNumber: "A-00000002", nextControl: "00-00000102", remaining: 4 });
  });

  it("numera sin saltos aunque las hojas se usen en otro orden", () => {
    const first = issue(sell([[shoeId, 1]]).id, { control: "103" });
    const second = issue(sell([[shoeId, 1]]).id);
    expect([first.number, first.control]).toEqual(["A-00000001", "00-00000103"]);
    expect([second.number, second.control]).toEqual(["A-00000002", "00-00000101"]);
  });

  it("acepta el número de control escrito de varias formas", () => {
    expect(issue(sell([[shoeId, 1]]).id, { control: "00-00000102" }).control).toBe("00-00000102");
    expect(issue(sell([[shoeId, 1]]).id, { control: " 0000000104 " }).control).toBe("00-00000104");
  });

  it("una venta lleva una sola factura vigente", () => {
    const sale = sell([[shoeId, 1]]);
    issue(sale.id);
    expect(() => issue(sale.id)).toThrow(/ya tiene la factura A-00000001/);
  });

  it("no gasta dos veces un número de control ni acepta uno de otro lote", () => {
    issue(sell([[shoeId, 1]]).id, { control: "101" });
    expect(() => issue(sell([[shoeId, 1]]).id, { control: "101" })).toThrow(/ya se usó/);
    expect(() => issue(sell([[shoeId, 1]]).id, { control: "999" })).toThrow(/no es del lote en uso/);
    expect(() => issue(sell([[shoeId, 1]]).id, { control: "01-00000102" })).toThrow(/no es del lote en uso/);
    expect(() => issue(sell([[shoeId, 1]]).id, { control: "" })).toThrow(/número de control/);
  });

  it("exige el nombre y el documento del cliente", () => {
    const sale = sell([[shoeId, 1]]);
    expect(() => issue(sale.id, { customer: { ...maria, name: " " } })).toThrow(/nombre o la razón social/);
    expect(() => issue(sale.id, { customer: { ...maria, doc: "" } })).toThrow(/cédula o el RIF/);
    expect(invoiceOfSale(db, sale.id)).toBeNull();
  });

  it("un contribuyente ordinario no factura una venta cobrada sin desglosar el impuesto", () => {
    const plain = sell([[shoeId, 1]], noon, { ...saleSettings, "tax.enabled": false });
    expect(() => issue(plain.id)).toThrow(/sin desglosar el impuesto/);
    // Un contribuyente formal sí: su factura no desglosa nada.
    const formal: InvoiceSettings = { ...settings, "invoice.regime": "formal", "tax.enabled": false };
    expect(issue(plain.id, {}, formal).issuer.regime).toBe("formal");
  });

  it("no emite con la facturación apagada, sin lote o con el lote agotado", () => {
    const sale = sell([[shoeId, 1]]);
    expect(() => issue(sale.id, { control: "101" }, { ...settings, "invoice.mode": "off" })).toThrow(/apagada/);
    expect(() => issue(sale.id, { control: "101" }, { ...settings, "store.taxId": "" })).toThrow(/falta el RIF de la tienda/);
    for (let i = 0; i < 5; i++) issue(sell([[shoeId, 1]]).id);
    expect(invoiceStatus(db, settings)).toMatchObject({ nextControl: null, remaining: 0 });
    expect(() => issue(sale.id, { control: "101" })).toThrow(/se agotaron/);
  });

  it("la primera factura puede empezar en otro número, y de ahí sigue", () => {
    const from500: InvoiceSettings = { ...settings, "invoice.start": 500 };
    expect(issue(sell([[shoeId, 1]]).id, {}, from500).number).toBe("A-00000500");
    expect(issue(sell([[shoeId, 1]]).id, {}, from500).number).toBe("A-00000501");
    // Bajar después el número inicial no hace retroceder la numeración.
    expect(issue(sell([[shoeId, 1]]).id, {}, settings).number).toBe("A-00000502");
  });
});

describe("anular", () => {
  beforeEach(() => {
    lot();
  });

  it("una factura anulada deja la venta libre para facturarla de nuevo, con otro número y otra hoja", () => {
    const sale = sell([[shoeId, 1]]);
    const first = issue(sale.id);
    const voided = voidInvoice(db, first.id, "RIF del cliente mal escrito", noon);
    expect(voided.voided).toEqual({ reason: "RIF del cliente mal escrito", at: noon.toISOString() });
    expect(invoiceOfSale(db, sale.id)).toBeNull();

    const second = issue(sale.id);
    expect([second.number, second.control]).toEqual(["A-00000002", "00-00000102"]);
    expect(() => voidInvoice(db, first.id, "Otra vez")).toThrow(/ya estaba anulada/);
    expect(() => voidInvoice(db, second.id, "  ")).toThrow(UserError);
  });

  it("una hoja dañada se anula y su número no se vuelve a ofrecer", () => {
    expect(voidSheet(db, "101", "Se atascó en la impresora", noon)).toBe("00-00000102");
    expect(invoiceStatus(db, settings)).toMatchObject({ nextControl: "00-00000102", remaining: 4 });
    expect(() => voidSheet(db, "101", "Otra vez")).toThrow(/ya se usó o ya estaba anulada/);
    expect(() => issue(sell([[shoeId, 1]]).id, { control: "101" })).toThrow(/ya se usó/);
    expect(() => voidSheet(db, "102", "")).toThrow(UserError);
  });

  it("las facturas, sus anulaciones y las hojas anuladas son hechos", () => {
    const invoice = issue(sell([[shoeId, 1]]).id);
    voidInvoice(db, invoice.id, "Prueba");
    voidSheet(db, "105", "Rota");
    expect(() => db.exec("UPDATE invoices SET number = 'X'")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM invoices")).toThrow(/no se borran/);
    expect(() => db.exec("DELETE FROM invoice_voids")).toThrow(/no se borran/);
    expect(() => db.exec("DELETE FROM voided_sheets")).toThrow(/no se borran/);
  });
});

describe("anotar una factura emitida por otro medio", () => {
  const external: InvoiceSettings = { ...settings, "invoice.mode": "externa" };

  it("guarda su número, su control y su fecha junto a la venta", () => {
    const sale = sell([[shoeId, 1]]);
    const invoice = recordExternal(db, { saleId: sale.id, number: "00012345", control: "Z1B8001234", issuedOn: "2026-10-05" }, external, noon);
    expect(invoice).toMatchObject({ kind: "externa", number: "00012345", control: "Z1B8001234", issuedOn: "2026-10-05" });
    expect(invoiceOfSale(db, sale.id)?.id).toBe(invoice.id);
    expect(() => recordExternal(db, { saleId: sale.id, number: "00012346", control: "", issuedOn: "2026-10-05" }, external)).toThrow(/ya tiene la factura/);
  });

  it("exige el número y una fecha válida, y no funciona con la facturación apagada", () => {
    const sale = sell([[shoeId, 1]]);
    expect(() => recordExternal(db, { saleId: sale.id, number: "", control: "", issuedOn: "2026-10-05" }, external)).toThrow(UserError);
    expect(() => recordExternal(db, { saleId: sale.id, number: "1", control: "", issuedOn: "5 de octubre" }, external)).toThrow(/fecha/);
    expect(() => recordExternal(db, { saleId: sale.id, number: "1", control: "", issuedOn: "2026-10-05" }, { ...settings, "invoice.mode": "off" })).toThrow(
      /apagada/
    );
  });

  it("dos facturas externas pueden compartir el registro de la misma máquina fiscal", () => {
    recordExternal(db, { saleId: sell([[shoeId, 1]]).id, number: "1", control: "Z1B8001234", issuedOn: "2026-10-05" }, external);
    expect(recordExternal(db, { saleId: sell([[shoeId, 1]]).id, number: "2", control: "Z1B8001234", issuedOn: "2026-10-05" }, external).number).toBe("2");
  });
});

describe("auxiliar del libro de ventas", () => {
  beforeEach(() => {
    lot();
    // Un zapato (116 $ con 16 % dentro) y un libro exento (50 $): a 100 Bs por dólar.
    issue(sell([[shoeId, 1], [bookId, 1]]).id);
    const voided = issue(sell([[shoeId, 2]]).id);
    voidInvoice(db, voided.id, "Cliente equivocado", noon);
    voidSheet(db, "105", "Hoja manchada", noon);
    // Una factura de noviembre no entra en octubre.
    issue(sell([[bookId, 1]], new Date(2026, 9, 5, 13, 0)).id, {}, settings, new Date(2026, 10, 2, 9, 0));
  });

  it("lista las facturas del mes con sus montos en bolívares y su total", () => {
    const book = salesBook(db, "2026-10");
    expect(book.rows.map((row) => [row.number, row.control, row.voided, row.total, row.exempt, row.taxes])).toEqual([
      ["A-00000001", "00-00000101", false, 1_660_000, 500_000, [{ rate: 1600, base: 1_000_000, tax: 160_000 }]],
      ["A-00000002", "00-00000102", true, 0, 0, []],
    ]);
    expect(book.rows[0]).toMatchObject({ issuedOn: "2026-10-05", customerName: "María Pérez", customerDoc: "V-12345678" });
    expect(book.totals).toEqual({ total: 1_660_000, exempt: 500_000, taxes: [{ rate: 1600, base: 1_000_000, tax: 160_000 }] });
    expect(book.voidedSheets).toEqual([{ control: "00-00000105", reason: "Hoja manchada", at: noon.toISOString() }]);
    expect(salesBook(db, "2026-11").rows.map((row) => row.number)).toEqual(["A-00000003"]);
    expect(salesBook(db, "2026-12").rows).toEqual([]);
  });

  it("cada fila suma: exento más bases más impuestos dan el total", () => {
    for (const row of salesBook(db, "2026-10").rows) {
      expect(row.exempt + row.taxes.reduce((sum, tax) => sum + tax.base + tax.tax, 0)).toBe(row.total);
    }
  });

  it("se exporta como hoja de cálculo que Excel abre en español", () => {
    const lines = bookCsv(salesBook(db, "2026-10")).replace("﻿", "").trimEnd().split("\r\n");
    expect(lines).toEqual([
      "Fecha;Factura;Control;Cliente;RIF o cédula;Total;Exento o no gravado;Base 16 %;Impuesto 16 %;Estado",
      "05/10/2026;A-00000001;00-00000101;María Pérez;V-12345678;16600,00;5000,00;10000,00;1600,00;Emitida",
      "05/10/2026;A-00000002;00-00000102;María Pérez;V-12345678;0,00;0,00;0,00;0,00;ANULADA",
      "05/10/2026;;00-00000105;Hoja manchada;;0,00;0,00;0,00;0,00;HOJA ANULADA",
      ";;;TOTALES;;16600,00;5000,00;10000,00;1600,00;",
    ]);
  });

  it("escapa los textos con punto y coma o comillas", () => {
    issue(sell([[bookId, 1]]).id, { customer: { ...maria, name: 'Librería "El Faro"; sucursal' } });
    expect(bookCsv(salesBook(db, "2026-10"))).toContain('"Librería ""El Faro""; sucursal"');
  });

  it("rechaza un mes mal escrito", () => {
    expect(() => salesBook(db, "octubre")).toThrow(TypeError);
    expect(() => salesBook(db, "2026-13")).toThrow(TypeError);
  });
});
