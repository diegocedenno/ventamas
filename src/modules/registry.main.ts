import { sortByDependencies } from "@shared/modules";
import type { MainModule } from "../main/modules";
import { nucleoModule } from "./nucleo/main";

// Módulos compilados dentro de la aplicación. Añadir uno nuevo es añadirlo a esta lista
// (y a registry.renderer.ts si tiene pantallas).
export const mainModules: MainModule[] = sortByDependencies([nucleoModule]);
