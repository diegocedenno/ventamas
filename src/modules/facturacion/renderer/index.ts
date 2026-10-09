import { FileText } from "lucide-react";
import type { RendererModule } from "../../../renderer/src/modules";
import { SALE_SLOT } from "../../ventas/renderer/SaleDialog";
import { manifest } from "../manifest";
import { InvoiceAction } from "./InvoiceAction";
import { InvoiceSettings } from "./InvoiceSettings";
import { InvoicesScreen } from "./InvoicesScreen";
import { t } from "./texts";
import "./facturacion.css";

export const facturacionModule: RendererModule = {
  manifest,
  // La pantalla de facturas solo aparece en las tiendas que facturan con Ventamas o anotan sus facturas.
  screens: [
    { id: "facturas", label: t("nav"), icon: FileText, component: InvoicesScreen, order: 25, when: (settings) => settings["invoice.mode"] !== "off" },
  ],
  settings: [{ id: "facturacion", label: t("settings.label"), component: InvoiceSettings, order: 50 }],
  slots: [{ slot: SALE_SLOT, component: InvoiceAction, order: 10 }],
};
