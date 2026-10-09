import { Users } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { manifest } from "../manifest";
import { CustomersScreen } from "./CustomersScreen";
import { t } from "./texts";
import "./clientes.css";

export const clientesModule: RendererModule = {
  manifest,
  screens: [{ id: "clientes", label: t("nav"), icon: Users, component: CustomersScreen, order: 40 }],
};
