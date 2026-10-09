import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { UserError } from "@shared/errors";
import { openDatabase, type Db } from "../../../main/db/database";
import { runMigrations } from "../../../main/db/migrate";
import type { CustomerInput } from "../api";
import { getCustomer, listCustomers, saveCustomer, setCustomerActive } from "./customers";
import { migrations } from "./migrations";

let db: Db;

beforeEach(() => {
  db = openDatabase(":memory:");
  runMigrations(db, [{ module: "clientes", migrations }]);
});

afterEach(() => db.close());

const maria = (overrides: Partial<CustomerInput> = {}): CustomerInput => ({
  name: "María Pérez",
  doc: "v12345678",
  phone: "0414-555.12.34",
  email: "",
  address: "",
  note: "",
  ...overrides,
});

const names = (query = "", includeInactive = false) => listCustomers(db, query, includeInactive).map((c) => c.name);

describe("guardar clientes", () => {
  it("crea un cliente y le da formato a su documento", () => {
    const customer = saveCustomer(db, maria({ email: " Maria@Correo.com " }));
    expect(customer).toMatchObject({ name: "María Pérez", doc: "V-12345678", phone: "0414-555.12.34", email: "maria@correo.com", active: true });
    expect(getCustomer(db, customer.id)).toEqual(customer);
  });

  it("basta el nombre", () => {
    const customer = saveCustomer(db, { name: "  Cliente   de paso " } as CustomerInput);
    expect(customer).toMatchObject({ name: "Cliente de paso", doc: "", phone: "", address: "" });
  });

  it("edita un cliente sin crear otro", () => {
    const created = saveCustomer(db, maria());
    const edited = saveCustomer(db, maria({ id: created.id, name: "María Pérez de León", address: "Av. Principal, Chacao" }));
    expect(edited.id).toBe(created.id);
    expect(edited.address).toBe("Av. Principal, Chacao");
    expect(names()).toEqual(["María Pérez de León"]);
  });

  it("no admite dos clientes con el mismo documento", () => {
    saveCustomer(db, maria());
    expect(() => saveCustomer(db, maria({ name: "Otra María", doc: "V-12.345.678" }))).toThrow(/Ya hay un cliente con el documento V-12345678/);
    // Sin documento sí pueden repetirse los nombres.
    saveCustomer(db, maria({ doc: "" }));
    expect(names()).toHaveLength(2);
  });

  it("rechaza un cliente sin nombre, un correo imposible y un cliente que no existe", () => {
    expect(() => saveCustomer(db, maria({ name: "   " }))).toThrow(UserError);
    expect(() => saveCustomer(db, maria({ email: "maria@" }))).toThrow(UserError);
    expect(() => saveCustomer(db, maria({ id: "no-existe" }))).toThrow(UserError);
    expect(names()).toEqual([]);
  });
});

describe("buscar clientes", () => {
  beforeEach(() => {
    saveCustomer(db, maria());
    saveCustomer(db, { name: "Inversiones Ávila, C.A.", doc: "J-00124134-5", phone: "(0212) 555 00 11", email: "", address: "", note: "" });
    saveCustomer(db, { name: "José Ángel Gómez", doc: "", phone: "0424 7654321", email: "", address: "", note: "" });
  });

  it("sin texto devuelve todos, por nombre", () => {
    expect(names()).toEqual(["Inversiones Ávila, C.A.", "José Ángel Gómez", "María Pérez"]);
  });

  it("busca por nombre sin importar acentos ni mayúsculas", () => {
    expect(names("avila")).toEqual(["Inversiones Ávila, C.A."]);
    expect(names("JOSE gomez")).toEqual(["José Ángel Gómez"]);
    expect(names("zzz")).toEqual([]);
  });

  it("busca por documento, con o sin separadores", () => {
    expect(names("12345678")).toEqual(["María Pérez"]);
    expect(names("12.345.678")).toEqual(["María Pérez"]);
    expect(names("v-12345678")).toEqual(["María Pérez"]);
    expect(names("j-00124134")).toEqual(["Inversiones Ávila, C.A."]);
  });

  it("busca por teléfono, se haya escrito como se haya escrito", () => {
    expect(names("04145551234")).toEqual(["María Pérez"]);
    expect(names("0414-555")).toEqual(["María Pérez"]);
    expect(names("7654321")).toEqual(["José Ángel Gómez"]);
  });
});

describe("archivar clientes", () => {
  it("un cliente archivado no aparece, pero se puede recuperar", () => {
    const customer = saveCustomer(db, maria());
    setCustomerActive(db, customer.id, false);
    expect(names()).toEqual([]);
    expect(names("", true)).toEqual(["María Pérez"]);
    expect(setCustomerActive(db, customer.id, true).active).toBe(true);
  });

  it("el documento de un cliente archivado queda libre, y ya no se puede recuperar si otro lo tomó", () => {
    const old = saveCustomer(db, maria());
    setCustomerActive(db, old.id, false);
    saveCustomer(db, maria({ name: "María Pérez (nueva ficha)" }));
    expect(() => setCustomerActive(db, old.id, true)).toThrow(/ya usa el documento/);
  });
});
