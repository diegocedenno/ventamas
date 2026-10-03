// Un módulo es una carpeta en src/modules con un manifiesto. El núcleo y cada función
// (ventas, inventario, clientes...) son módulos; cada tipo de comercio activa los suyos.

export interface ModuleManifest {
  /** Identificador estable: nunca cambia una vez publicado. */
  id: string;
  /** Módulos que deben estar activos para que este funcione. */
  depends: readonly string[];
}

/** Ordena los módulos de modo que cada uno quede después de sus dependencias. */
export function sortByDependencies<T extends { manifest: ModuleManifest }>(modules: readonly T[]): T[] {
  const byId = new Map(modules.map((m) => [m.manifest.id, m]));
  if (byId.size !== modules.length) throw new Error("Hay módulos con el mismo identificador.");

  const sorted: T[] = [];
  const state = new Map<string, "visiting" | "done">();

  const visit = (module: T, path: string[]): void => {
    const id = module.manifest.id;
    if (state.get(id) === "done") return;
    if (state.get(id) === "visiting") {
      throw new Error(`Dependencia circular entre módulos: ${[...path, id].join(" → ")}`);
    }
    state.set(id, "visiting");
    for (const dep of module.manifest.depends) {
      const found = byId.get(dep);
      if (!found) throw new Error(`El módulo "${id}" depende de "${dep}", que no existe.`);
      visit(found, [...path, id]);
    }
    state.set(id, "done");
    sorted.push(module);
  };

  for (const module of modules) visit(module, []);
  return sorted;
}
