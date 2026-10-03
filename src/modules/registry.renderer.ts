import { sortByDependencies } from "@shared/modules";
import type { RendererModule } from "../renderer/src/modules";
import { coreModule } from "./core/renderer";

export const rendererModules: RendererModule[] = sortByDependencies([coreModule]);
