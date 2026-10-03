import { sortByDependencies } from "@shared/modules";
import type { RendererModule } from "../renderer/src/modules";
import { monedasModule } from "./monedas/renderer";
import { nucleoModule } from "./nucleo/renderer";

export const rendererModules: RendererModule[] = sortByDependencies([nucleoModule, monedasModule]);
