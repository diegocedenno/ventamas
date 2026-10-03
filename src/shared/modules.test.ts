import { describe, expect, it } from "vitest";
import { sortByDependencies } from "./modules";

const mod = (id: string, depends: string[] = []) => ({ manifest: { id, depends } });
const ids = (list: Array<{ manifest: { id: string } }>) => list.map((m) => m.manifest.id);

describe("sortByDependencies", () => {
  it("pone cada módulo después de sus dependencias", () => {
    const sorted = sortByDependencies([mod("ventas", ["inventario", "nucleo"]), mod("inventario", ["nucleo"]), mod("nucleo")]);
    expect(ids(sorted)).toEqual(["nucleo", "inventario", "ventas"]);
  });

  it("conserva el orden cuando no hay dependencias", () => {
    expect(ids(sortByDependencies([mod("a"), mod("b"), mod("c")]))).toEqual(["a", "b", "c"]);
  });

  it("avisa si falta una dependencia", () => {
    expect(() => sortByDependencies([mod("ventas", ["inventario"])])).toThrow(/inventario/);
  });

  it("avisa si hay un ciclo", () => {
    expect(() => sortByDependencies([mod("a", ["b"]), mod("b", ["a"])])).toThrow(/circular/);
  });

  it("avisa si dos módulos comparten identificador", () => {
    expect(() => sortByDependencies([mod("a"), mod("a")])).toThrow(/mismo identificador/);
  });
});
