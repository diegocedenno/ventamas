import { sortByDependencies } from "@shared/modules";
import type { MainModule } from "../main/modules";
import { cajaModule } from "./caja/main";
import { inventarioModule } from "./inventario/main";
import { monedasModule } from "./monedas/main";
import { nucleoModule } from "./nucleo/main";

// Módulos compilados dentro de la aplicación. Añadir uno nuevo es añadirlo a esta lista
// (y a registry.renderer.ts si tiene pantallas).
export const mainModules: MainModule[] = sortByDependencies([nucleoModule, monedasModule, inventarioModule, cajaModule]);
