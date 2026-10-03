import { sortByDependencies } from "@shared/modules";
import type { MainModule } from "../main/modules";
import { coreModule } from "./core/main";

// Módulos compilados dentro de la aplicación. Añadir uno nuevo es añadirlo a esta lista
// (y a registry.renderer.ts si tiene pantallas).
export const mainModules: MainModule[] = sortByDependencies([coreModule]);
