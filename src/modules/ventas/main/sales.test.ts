import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { money } from "@shared/money";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import { closeSession, openSession, sessionSummary, setMethodActive } from "../../caja/main/cash";
import { saveCustomer, setCustomerActive } from "../../clientes/main/customers";
import { saveTaxClass } from "../../impuestos/main/taxes";
import type { Product, ProductInput } from "../../inventario/api";
import { getProduct, saveProduct, setProductActive } from "../../inventario/main/products";
import { saveRates } from "../../monedas/main/rates";
import { mainModules } from "../../registry.main";
import type { SaleInput } from "../api";
import { discardParked, listParked, parkSale, takeParked } from "./parked";
import { createSale, getSale, listSales, salesOfSession, type SaleSettings } from "./sales";

let db: Db;
let shoe: Product;
let blouse: Product;
let sessionId: string;

const settings: SaleSettings = { "store.currency": "USD", "device.prefix": "C01", "tax.enabled": false, "tax.included": true };
const withTax: SaleSettings = { ...settings, "tax.enabled": true };
const morning = new Date(2026, 9, 5, 8, 0);
const noon = new Date(2026, 9, 5, 12, 0);

const item = (overrides: Partial<ProductInput>): ProductInput => ({
  name: "Producto",
  kind: "producto",
  category: "",
  price: 1000,
  cost: null,
  option1: "",
  option2: "",
  minStock: null,
  openPrice: false,
  taxClass: "general",
  variants: [{ value1: "", value2: "", code: "", stock: 0, price: null, cost: null }],
  ...overrides,
});

const create = (input: ProductInput) => saveProduct(db, input, { currency: "USD" }, morning);

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(
    db,
    mainModules.map((m) => ({ module: m.manifest.id, migrations: m.migrations }))
  );
  saveRates(db, { rates: { USD: 866_560_000, EUR: 973_928_133 }, source: "manual" }, morning);
  shoe = create(
    item({
      name: "Zapato deportivo",
      category: "Calzado",
      price: 4500,
      cost: 2800,
      option1: "Talla",
      variants: [
        { value1: "37", value2: "", code: "", stock: 2, price: null, cost: null },
        { value1: "38", value2: "", code: "", stock: 3, price: null, cost: null },
      ],
    })
  );
  blouse = create(
    item({ name: "Blusa", category: "Ropa", price: 2000, option1: "Talla", variants: [{ value1: "M", value2: "", code: "", stock: 1, price: null, cost: null }] })
  );
  sessionId = openSession(db, { floats: [{ methodId: "efectivo-usd", amount: 2000 }] }, morning).id;
});

afterEach(() => db.close());

const shoe38 = () => shoe.variants[1]!.id;
const blouseM = () => blouse.variants[0]!.id;
const line = (variantId: string, quantity = 1, discount = 0, price?: number) => ({ variantId, quantity, discount, price });
const cash = (amount: number) => [{ methodId: "efectivo-usd", amount, note: "" }];

const sale = (overrides: Partial<SaleInput>): SaleInput => ({
  lines: [],
  discount: null,
  customerId: null,
  note: "",
  payments: [],
  change: [],
  expectedTotal: 0,
  ...overrides,
});

// La venta de referencia del PRD: zapatos 38 (45 $) y blusa M (20 $); 40 $ en efectivo
// y el resto por pago móvil.
const reference = (): SaleInput =>
  sale({
    lines: [line(shoe38()), line(blouseM())],
    payments: [
      { methodId: "efectivo-usd", amount: 4000, note: "" },
      { methodId: "pago-movil", amount: 2166400, note: "4821" },
    ],
    expectedTotal: 6500,
  });

const sell = (input: SaleInput, at = noon, config = settings) => createSale(db, input, config, at);
const stock = (product: Product) => getProduct(db, product.id).variants.map((v) => v.stock);
const totalsOf = (methodId: string) => sessionSummary(db, sessionId).totals.find((t) => t.method.id === methodId)!;

describe("registrar una venta", () => {
  it("la venta de referencia queda completa: líneas, pagos, inventario y caja", () => {
    const sold = sell(reference());

    expect(sold).toMatchObject({
      number: "C01-000001",
      currency: "USD",
      subtotal: 6500,
      lineDiscounts: 0,
      discount: 0,
      tax: 0,
      taxes: [],
      total: 6500,
      customer: null,
      createdAt: noon.toISOString(),
    });
    expect(sold.lines).toMatchObject([
      { description: "Zapato deportivo · 38", kind: "producto", quantity: 1, unitPrice: 4500, discount: 0, share: 0, total: 4500, taxCode: "", taxRate: null },
      { description: "Blusa · M", quantity: 1, unitPrice: 2000, total: 2000 },
    ]);
    expect(sold.payments).toEqual([
      { methodName: "Dólares efectivo", currency: "USD", amount: 4000, note: "" },
      { methodName: "Pago móvil", currency: "VES", amount: 2166400, note: "4821" },
    ]);
    expect(sold.change).toEqual([]);
    expect(sold.rates).toEqual({ pivot: "VES", rates: { USD: 866_560_000, EUR: 973_928_133 } });

    expect(stock(shoe)).toEqual([2, 2]);
    expect(stock(blouse)).toEqual([0]);
    expect(totalsOf("efectivo-usd")).toMatchObject({ opening: 2000, sales: 4000, expected: 6000 });
    expect(totalsOf("pago-movil")).toMatchObject({ sales: 2166400 });
    expect(sessionSummary(db, sessionId)).toMatchObject({ salesCount: 1, salesTotals: [money(6500, "USD")] });
    expect(getSale(db, sold.id)).toEqual(sold);
  });

  it("numera las ventas en orden y las lista de la más reciente a la más antigua", () => {
    sell(reference());
    const second = sell(
      sale({ lines: [line(shoe38(), 2)], payments: [{ methodId: "zelle", amount: 9000, note: "" }], expectedTotal: 9000 }),
      new Date(2026, 9, 5, 13, 0)
    );
    expect(second.number).toBe("C01-000002");
    expect(salesOfSession(db, sessionId).map((s) => [s.number, s.total, s.pieces])).toEqual([
      ["C01-000002", 9000, 2],
      ["C01-000001", 6500, 2],
    ]);
  });

  it("registra el vuelto, incluso en otra moneda", () => {
    // Blusa de 20 $ pagada con 50 €: 50 € son 48.696,41 Bs y la blusa 17.331,20 Bs: 31.365,21 Bs de vuelto.
    const sold = sell(
      sale({
        lines: [line(blouseM())],
        payments: [{ methodId: "efectivo-eur", amount: 5000, note: "" }],
        change: [{ methodId: "efectivo-ves", amount: 3136521 }],
        expectedTotal: 2000,
      })
    );
    expect(sold.change).toEqual([{ methodName: "Bolívares efectivo", currency: "VES", amount: 3136521, note: "" }]);
    expect(totalsOf("efectivo-eur")).toMatchObject({ sales: 5000, expected: 5000 });
    expect(totalsOf("efectivo-ves")).toMatchObject({ change: -3136521, expected: -3136521 });
    expect(sessionSummary(db, sessionId).salesTotals).toEqual([money(2000, "USD")]);
  });

  it("se puede vender sin existencias: la pieza queda en negativo para revisar", () => {
    sell(sale({ lines: [line(blouseM(), 3)], payments: cash(6000), expectedTotal: 6000 }));
    expect(stock(blouse)).toEqual([-2]);
  });

  it("guarda la tasa con la que se cobró aunque después cambie", () => {
    const sold = sell(reference());
    saveRates(db, { rates: { USD: 900_000_000, EUR: 990_000_000 }, source: "manual" }, new Date(2026, 9, 5, 15, 0));
    expect(getSale(db, sold.id).rates.rates.USD).toBe(866_560_000);
    expect(db.prepare("SELECT rate FROM money_movements WHERE sale_id = ? AND currency = 'USD'").get(sold.id)).toEqual({ rate: 866_560_000 });
    expect(db.prepare("SELECT rate FROM money_movements WHERE sale_id = ? AND currency = 'VES'").get(sold.id)).toEqual({ rate: null });
  });

  it("el precio de la venta es el de la base de datos y no cambia si el producto cambia después", () => {
    const sold = sell(reference());
    create({ ...item({ name: "Zapato urbano", category: "Calzado", price: 9900, option1: "Talla" }), id: shoe.id, variants: getProduct(db, shoe.id).variants });
    expect(getSale(db, sold.id).lines[0]).toMatchObject({ description: "Zapato deportivo · 38", unitPrice: 4500 });
  });

  it("guarda lo que costaba cada pieza al venderla", () => {
    const sold = sell(reference());
    expect(db.prepare("SELECT unit_cost FROM sale_lines WHERE sale_id = ? ORDER BY position").all(sold.id)).toEqual([
      { unit_cost: 2800 },
      { unit_cost: null },
    ]);
  });

  it("una pieza con precio propio se cobra a su precio", () => {
    const paint = create(
      item({
        name: "Pintura",
        price: 1500,
        option1: "Presentación",
        variants: [
          { value1: "Cuarto", value2: "", code: "", stock: 5, price: null, cost: null },
          { value1: "Galón", value2: "", code: "", stock: 5, price: 4800, cost: null },
        ],
      })
    );
    const sold = sell(sale({ lines: [line(paint.variants[0]!.id), line(paint.variants[1]!.id)], payments: cash(6300), expectedTotal: 6300 }));
    expect(sold.lines.map((l) => [l.description, l.unitPrice])).toEqual([
      ["Pintura · Cuarto", 1500],
      ["Pintura · Galón", 4800],
    ]);
  });
});

describe("descuentos", () => {
  it("el descuento de una línea baja esa línea y queda en la venta", () => {
    const sold = sell(sale({ lines: [line(shoe38(), 2, 900), line(blouseM())], payments: cash(10100), expectedTotal: 10100 }));
    expect(sold).toMatchObject({ subtotal: 11000, lineDiscounts: 900, discount: 0, total: 10100 });
    expect(sold.lines.map((l) => [l.discount, l.share, l.total])).toEqual([
      [900, 0, 8100],
      [0, 0, 2000],
    ]);
    expect(sessionSummary(db, sessionId).salesTotals).toEqual([money(10100, "USD")]);
  });

  it("el descuento general se reparte entre las líneas y recuerda su porcentaje", () => {
    const sold = sell(
      sale({ lines: [line(shoe38()), line(blouseM())], discount: { kind: "percent", value: 1000 }, payments: cash(5850), expectedTotal: 5850 })
    );
    expect(sold).toMatchObject({ subtotal: 6500, discount: 650, discountPercent: 1000, total: 5850 });
    expect(sold.lines.map((l) => [l.share, l.total])).toEqual([
      [450, 4050],
      [200, 1800],
    ]);
  });

  it("acepta un descuento general como monto, y una venta regalada al 100 %", () => {
    const sold = sell(sale({ lines: [line(blouseM())], discount: { kind: "amount", value: 500 }, payments: cash(1500), expectedTotal: 1500 }));
    expect(sold).toMatchObject({ discount: 500, discountPercent: null, total: 1500 });

    const gift = sell(sale({ lines: [line(shoe38())], discount: { kind: "percent", value: 10000 }, expectedTotal: 0 }));
    expect(gift).toMatchObject({ total: 0, discount: 4500, payments: [] });
    expect(stock(shoe)).toEqual([2, 2]);
  });

  it("rechaza descuentos mayores que lo que se vende", () => {
    expect(() => sell(sale({ lines: [line(blouseM(), 1, 2001)], payments: cash(1), expectedTotal: 0 }))).toThrow(/descuento/);
    expect(() => sell(sale({ lines: [line(blouseM())], discount: { kind: "amount", value: 2001 }, expectedTotal: 0 }))).toThrow(/descuento/);
    expect(() => sell(sale({ lines: [line(blouseM())], discount: { kind: "percent", value: 10001 }, expectedTotal: 0 }))).toThrow(/100 %/);
    expect(() => sell(sale({ lines: [line(blouseM(), 1, -1)], payments: cash(2000), expectedTotal: 2000 }))).toThrow(UserError);
    expect(salesOfSession(db, sessionId)).toEqual([]);
  });
});

describe("clientes", () => {
  it("la venta guarda el cliente con el nombre y el documento que tenía", () => {
    const maria = saveCustomer(db, { name: "María Pérez", doc: "V-12345678", phone: "", email: "", address: "", note: "" });
    const sold = sell({ ...reference(), customerId: maria.id, note: "Regalo, envolver" });
    expect(sold.customer).toEqual({ id: maria.id, name: "María Pérez", doc: "V-12345678" });
    expect(sold.note).toBe("Regalo, envolver");

    saveCustomer(db, { id: maria.id, name: "María Pérez de León", doc: "V-12345678", phone: "", email: "", address: "", note: "" });
    expect(getSale(db, sold.id).customer?.name).toBe("María Pérez");
    expect(salesOfSession(db, sessionId)[0]?.customerName).toBe("María Pérez");
  });

  it("no vende a un cliente archivado o que no existe", () => {
    const maria = saveCustomer(db, { name: "María Pérez", doc: "", phone: "", email: "", address: "", note: "" });
    setCustomerActive(db, maria.id, false);
    expect(() => sell({ ...reference(), customerId: maria.id })).toThrow(/cliente ya no existe/);
    expect(() => sell({ ...reference(), customerId: "no-existe" })).toThrow(/cliente ya no existe/);
  });
});

describe("servicios y precio abierto", () => {
  it("un servicio se vende sin tocar el inventario", () => {
    const cut = create(item({ name: "Corte de caballero", kind: "servicio", category: "Cortes", price: 800 }));
    const sold = sell(sale({ lines: [line(cut.variants[0]!.id, 2)], payments: cash(1600), expectedTotal: 1600 }));
    expect(sold.lines[0]).toMatchObject({ description: "Corte de caballero", kind: "servicio", quantity: 2, total: 1600 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM stock_movements WHERE reason = 'venta'").get()).toEqual({ n: 0 });
  });

  it("un producto de precio abierto se cobra al precio que se escribió", () => {
    const repair = create(item({ name: "Reparación", kind: "servicio", price: 0, openPrice: true }));
    const sold = sell(sale({ lines: [line(repair.variants[0]!.id, 1, 0, 3500)], payments: cash(3500), expectedTotal: 3500 }));
    expect(sold.lines[0]).toMatchObject({ unitPrice: 3500, total: 3500 });
    expect(() => sell(sale({ lines: [line(repair.variants[0]!.id)], expectedTotal: 0 }))).toThrow(/Escribe el precio/);
  });

  it("el precio que manda la pantalla se ignora si el producto no es de precio abierto", () => {
    expect(() => sell(sale({ lines: [line(blouseM(), 1, 0, 1)], payments: cash(1), expectedTotal: 1 }))).toThrow(/precios cambiaron/);
  });
});

describe("impuestos", () => {
  it("con el impuesto incluido, el total no cambia y la venta guarda el desglose", () => {
    const sold = sell(reference(), noon, withTax);
    expect(sold).toMatchObject({ total: 6500, tax: 897, taxIncluded: true });
    // 65,00 con 16 % dentro: base 56,03 e impuesto 8,97.
    expect(sold.taxes).toEqual([{ id: "general", name: "IVA general", code: "G", rate: 1600, base: 5603, tax: 897 }]);
    expect(sold.lines.map((l) => [l.taxCode, l.taxRate, l.tax])).toEqual([
      ["G", 1600, 621],
      ["G", 1600, 276],
    ]);
    expect(sessionSummary(db, sessionId).salesTotals).toEqual([money(6500, "USD")]);
  });

  it("separa lo exento y lo de tasa reducida", () => {
    const book = create(item({ name: "Libro", price: 1000, taxClass: "exento" }));
    const flour = create(item({ name: "Harina", price: 1080, taxClass: "reducida" }));
    const sold = sell(
      sale({ lines: [line(shoe38()), line(book.variants[0]!.id), line(flour.variants[0]!.id)], payments: cash(6580), expectedTotal: 6580 }),
      noon,
      withTax
    );
    expect(sold.taxes).toEqual([
      { id: "general", name: "IVA general", code: "G", rate: 1600, base: 3879, tax: 621 },
      { id: "exento", name: "Exento", code: "E", rate: 0, base: 1000, tax: 0 },
      { id: "reducida", name: "IVA reducido", code: "R", rate: 800, base: 1000, tax: 80 },
    ]);
    expect(sold.tax).toBe(701);
  });

  it("con el impuesto aparte, se suma al total", () => {
    const sold = sell(sale({ lines: [line(shoe38()), line(blouseM())], payments: cash(7540), expectedTotal: 7540 }), noon, {
      ...withTax,
      "tax.included": false,
    });
    expect(sold).toMatchObject({ subtotal: 6500, tax: 1040, taxIncluded: false, total: 7540 });
    expect(sold.taxes).toEqual([{ id: "general", name: "IVA general", code: "G", rate: 1600, base: 6500, tax: 1040 }]);
    expect(sessionSummary(db, sessionId).salesTotals).toEqual([money(7540, "USD")]);
  });

  it("la venta guarda la tasa con la que se cobró aunque el impuesto cambie después", () => {
    const sold = sell(reference(), noon, withTax);
    saveTaxClass(db, { id: "general", name: "IVA general", code: "G", rate: 1200, active: true });
    expect(getSale(db, sold.id).taxes[0]).toMatchObject({ rate: 1600, tax: 897 });
  });

  it("un producto cuya tasa ya no existe lleva la general", () => {
    db.prepare("UPDATE products SET tax_class = 'borrada' WHERE id = ?").run(blouse.id);
    const sold = sell(sale({ lines: [line(blouseM())], payments: cash(2000), expectedTotal: 2000 }), noon, withTax);
    expect(sold.taxes).toMatchObject([{ id: "general", rate: 1600 }]);
  });

  it("sin impuestos activados, la venta no guarda desglose", () => {
    const sold = sell(reference());
    expect(db.prepare("SELECT COUNT(*) AS n FROM sale_taxes WHERE sale_id = ?").get(sold.id)).toEqual({ n: 0 });
  });
});

describe("precios en bolívares", () => {
  it("una tienda con precios en bolívares vende y cobra en cualquier moneda", () => {
    const local: SaleSettings = { ...settings, "store.currency": "VES" };
    const flour = saveProduct(db, item({ name: "Harina", price: 86_656 }), { currency: "VES" }, morning);
    // 866,56 Bs se pagan con 1 $ exacto.
    const sold = createSale(
      db,
      sale({ lines: [line(flour.variants[0]!.id)], payments: [{ methodId: "efectivo-usd", amount: 100, note: "" }], expectedTotal: 86_656 }),
      local,
      noon
    );
    expect(sold).toMatchObject({ currency: "VES", total: 86_656 });
    expect(sessionSummary(db, sessionId).salesTotals).toEqual([money(86_656, "VES")]);
  });
});

describe("lo que impide vender", () => {
  const expectNothingSold = () => {
    expect(salesOfSession(db, sessionId)).toEqual([]);
    expect(stock(shoe)).toEqual([2, 3]);
    expect(totalsOf("efectivo-usd")).toMatchObject({ sales: 0, expected: 2000 });
  };

  it("la caja cerrada", () => {
    closeSession(db, { counts: [{ methodId: "efectivo-usd", counted: 2000 }], note: "" }, morning);
    expect(() => sell(reference())).toThrow(/caja está cerrada/);
  });

  it("la tasa del día sin confirmar", () => {
    expect(() => sell(reference(), new Date(2026, 9, 6, 9, 0))).toThrow(/Confirma la tasa de hoy/);
    expectNothingSold();
  });

  it("que falte dinero o que el vuelto no cuadre", () => {
    const short = reference();
    short.payments = [short.payments[0]!];
    expect(() => sell(short)).toThrow(/falta dinero/);

    const over = reference();
    over.payments[0]!.amount = 5000;
    expect(() => sell(over)).toThrow(/vuelto no cuadra/);

    const tooMuchChange = reference();
    tooMuchChange.payments[0]!.amount = 5000;
    tooMuchChange.change = [{ methodId: "efectivo-usd", amount: 1500 }];
    expect(() => sell(tooMuchChange)).toThrow(/vuelto no cuadra/);
    expectNothingSold();
  });

  it("que el precio haya cambiado mientras se cobraba", () => {
    create({ ...item({ name: shoe.name, category: shoe.category, price: 5000, option1: "Talla" }), id: shoe.id, variants: shoe.variants });
    expect(() => sell(reference())).toThrow(/precios cambiaron/);
    expectNothingSold();
  });

  it("un producto retirado o un medio de pago desactivado", () => {
    setProductActive(db, blouse.id, false);
    expect(() => sell(reference())).toThrow(/ya no está en venta/);
    setProductActive(db, blouse.id, true);

    setMethodActive(db, "pago-movil", false);
    expect(() => sell(reference())).toThrow(/desactivado/);
    expectNothingSold();
  });

  it("una venta vacía, cantidades imposibles o montos en cero", () => {
    expect(() => sell({ ...reference(), lines: [] })).toThrow(/no tiene productos/);
    expect(() => sell({ ...reference(), lines: [line(shoe38(), 0)] })).toThrow(/cantidad/);
    expect(() => sell({ ...reference(), lines: [line(shoe38(), 1.5)] })).toThrow(TypeError);
    const zero = reference();
    zero.payments[1]!.amount = 0;
    expect(() => sell(zero)).toThrow(UserError);
    expectNothingSold();
  });

  it("si algo falla a mitad, no queda nada a medias", () => {
    // Un medio de pago que no existe hace fallar la venta después de validar las líneas.
    const broken = reference();
    broken.payments[1]!.methodId = "no-existe";
    expect(() => sell(broken)).toThrow(UserError);
    expect(db.prepare("SELECT COUNT(*) AS n FROM sales").get()).toEqual({ n: 0 });
    expect(db.prepare("SELECT COUNT(*) AS n FROM sale_lines").get()).toEqual({ n: 0 });
    expectNothingSold();
  });
});

describe("las ventas son hechos", () => {
  it("no se pueden modificar ni borrar", () => {
    sell(reference(), noon, withTax);
    expect(() => db.exec("UPDATE sales SET total = 1")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM sales")).toThrow(/no se borran/);
    expect(() => db.exec("UPDATE sale_lines SET quantity = 9")).toThrow(/no se modifican/);
    expect(() => db.exec("UPDATE sale_taxes SET tax = 0")).toThrow(/no se modifican/);
    expect(() => db.exec("DELETE FROM sale_taxes")).toThrow(/no se borran/);
  });
});

describe("historial de ventas", () => {
  let mariaId: string;

  beforeEach(() => {
    mariaId = saveCustomer(db, { name: "María Pérez", doc: "", phone: "", email: "", address: "", note: "" }).id;
    sell({ ...reference(), customerId: mariaId }, noon);
    // Al día siguiente, con la tasa confirmada de nuevo.
    const nextDay = new Date(2026, 9, 6, 10, 0);
    saveRates(db, { rates: { USD: 870_000_000, EUR: 980_000_000 }, source: "manual" }, nextDay);
    sell(sale({ lines: [line(shoe38())], payments: cash(4500), expectedTotal: 4500 }), nextDay);
  });

  it("sin filtros trae todo, de lo más reciente a lo más antiguo, con su total", () => {
    const page = listSales(db);
    expect(page.sales.map((s) => [s.number, s.customerName])).toEqual([
      ["C01-000002", ""],
      ["C01-000001", "María Pérez"],
    ]);
    expect(page).toMatchObject({ count: 2, totals: [money(11000, "USD")] });
  });

  it("filtra por días de la tienda, con los dos extremos incluidos", () => {
    expect(listSales(db, { from: "2026-10-06" }).sales.map((s) => s.number)).toEqual(["C01-000002"]);
    expect(listSales(db, { to: "2026-10-05" }).sales.map((s) => s.number)).toEqual(["C01-000001"]);
    expect(listSales(db, { from: "2026-10-05", to: "2026-10-06" }).count).toBe(2);
    expect(listSales(db, { from: "2026-10-07" })).toMatchObject({ sales: [], count: 0, totals: [] });
  });

  it("busca por número de venta o por nombre del cliente", () => {
    expect(listSales(db, { query: "000002" }).sales.map((s) => s.number)).toEqual(["C01-000002"]);
    expect(listSales(db, { query: "c01-000001" }).count).toBe(1);
    expect(listSales(db, { query: "maria" }).sales.map((s) => s.number)).toEqual(["C01-000001"]);
    expect(listSales(db, { query: "zzz" }).count).toBe(0);
  });

  it("trae las compras de un cliente", () => {
    expect(listSales(db, { customerId: mariaId }).sales.map((s) => s.number)).toEqual(["C01-000001"]);
  });

  it("rechaza fechas que no lo son", () => {
    expect(() => listSales(db, { from: "ayer" })).toThrow(TypeError);
  });
});

describe("ventas en espera", () => {
  const parked = () => ({ label: "Señora del vestido", lines: [line(shoe38(), 2, 500), line(blouseM())], discount: null, customerId: null, note: "" });

  it("deja una venta en espera y la retoma con todo lo que tenía", () => {
    const maria = saveCustomer(db, { name: "María Pérez", doc: "", phone: "", email: "", address: "", note: "" });
    const list = parkSale(db, { ...parked(), customerId: maria.id, discount: { kind: "percent", value: 500 }, note: "Vuelve a las 3" }, noon);
    expect(list).toMatchObject([{ label: "Señora del vestido", pieces: 3, createdAt: noon.toISOString() }]);

    const resumed = takeParked(db, list[0]!.id);
    expect(resumed).toMatchObject({
      label: "Señora del vestido",
      dropped: 0,
      customerId: maria.id,
      discount: { kind: "percent", value: 500 },
      note: "Vuelve a las 3",
    });
    expect(resumed.lines).toMatchObject([
      { variantId: shoe38(), description: "Zapato deportivo · 38", unitPrice: 4500, quantity: 2, discount: 500, stock: 3, kind: "producto" },
      { variantId: blouseM(), unitPrice: 2000, quantity: 1, discount: 0, stock: 1 },
    ]);
    expect(listParked(db)).toEqual([]);
  });

  it("al retomarla trae los precios de ahora y deja fuera lo que ya no se vende", () => {
    const [info] = parkSale(db, parked(), noon);
    create({ ...item({ name: shoe.name, category: shoe.category, price: 100, option1: "Talla" }), id: shoe.id, variants: shoe.variants });
    setProductActive(db, blouse.id, false);

    const resumed = takeParked(db, info!.id);
    expect(resumed.dropped).toBe(1);
    // El zapato bajó a 1,00: el descuento de 5,00 ya no cabe en dos pares y se recorta.
    expect(resumed.lines).toMatchObject([{ unitPrice: 100, quantity: 2, discount: 200 }]);
  });

  it("no guarda ventas vacías, y una venta en espera solo se retoma una vez", () => {
    expect(() => parkSale(db, { ...parked(), lines: [] })).toThrow(/vacía/);
    const [info] = parkSale(db, parked());
    takeParked(db, info!.id);
    expect(() => takeParked(db, info!.id)).toThrow(/ya no está/);
  });

  it("se puede descartar, y hay un máximo de ventas en espera", () => {
    const [info] = parkSale(db, parked());
    expect(discardParked(db, info!.id)).toEqual([]);

    for (let i = 0; i < 30; i++) parkSale(db, { ...parked(), label: `Venta ${i}` });
    expect(() => parkSale(db, parked())).toThrow(/Ya hay 30 ventas en espera/);
  });

  it("dejar una venta en espera no toca el inventario ni la caja", () => {
    parkSale(db, parked());
    expect(stock(shoe)).toEqual([2, 3]);
    expect(salesOfSession(db, sessionId)).toEqual([]);
  });
});
