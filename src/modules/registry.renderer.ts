import { sortByDependencies } from "@shared/modules";
import type { RendererModule } from "../renderer/src/modules";
import { cajaModule } from "./caja/renderer";
import { inventarioModule } from "./inventario/renderer";
import { monedasModule } from "./monedas/renderer";
import { nucleoModule } from "./nucleo/renderer";

export const rendererModules: RendererModule[] = sortByDependencies([nucleoModule, monedasModule, inventarioModule, cajaModule]);
