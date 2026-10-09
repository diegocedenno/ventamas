import { sortByDependencies } from "@shared/modules";
import type { RendererModule } from "../renderer/src/modules";
import { cajaModule } from "./caja/renderer";
import { clientesModule } from "./clientes/renderer";
import { facturacionModule } from "./facturacion/renderer";
import { impuestosModule } from "./impuestos/renderer";
import { inventarioModule } from "./inventario/renderer";
import { monedasModule } from "./monedas/renderer";
import { nucleoModule } from "./nucleo/renderer";
import { ventasModule } from "./ventas/renderer";

export const rendererModules: RendererModule[] = sortByDependencies([
  nucleoModule,
  monedasModule,
  impuestosModule,
  inventarioModule,
  cajaModule,
  clientesModule,
  ventasModule,
  facturacionModule,
]);
