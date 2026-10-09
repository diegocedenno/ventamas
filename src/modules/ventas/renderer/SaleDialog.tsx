import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { APP } from "@shared/api";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { usePrint } from "../../../renderer/src/components/Print";
import { formatDateTime, formatMoney } from "../../../renderer/src/lib/format";
import { call, messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp, useSlot } from "../../../renderer/src/state";
import type { Sale } from "../api";
import { equivalents, ReceiptDocument } from "./Receipt";
import { t } from "./texts";

/** Lugar de la ventana de una venta donde otros módulos añaden lo suyo (la factura, por ejemplo). */
export const SALE_SLOT = "ventas.sale";

/** Lo que recibe cada pieza colocada en la ventana de una venta. */
export interface SaleSlotProps {
  sale: Sale;
}

interface SaleDialogProps {
  sale: Sale;
  /** Recién cobrada: el siguiente paso es otra venta. Si no, es una venta que se está consultando. */
  fresh: boolean;
  onClose(): void;
}

/** Una venta ya registrada: su resumen y las opciones de recibo. */
export function SaleDialog({ sale, fresh, onClose }: SaleDialogProps) {
  const { settings } = useApp();
  const printer = usePrint();
  const extras = useSlot<SaleSlotProps>(SALE_SLOT);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const width = settings["receipt.width"];
  const receipt = <ReceiptDocument sale={sale} store={settings} />;

  const once = useOnce();
  async function run(action: () => Promise<string | void>) {
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        const file = await action();
        if (typeof file === "string") setSaved(file);
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    });
  }

  return (
    <Dialog
      title={fresh ? t("done.title") : t("sale.title", { number: sale.number })}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={() => void run(() => printer.savePdf(receipt, width, sale.number))}>
            {t("sale.pdf")}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void run(() => printer.print(receipt, width))}>
            {t("sale.print")}
          </button>
          <button type="button" className="btn btn--primary" data-autofocus="" onClick={onClose}>
            {fresh ? t("sale.new") : t("sale.close")}
          </button>
        </>
      }
    >
      <div className="sale-summary">
        {fresh && <CircleCheck className="sale-check" size={40} strokeWidth={1.5} aria-hidden="true" />}
        <p className="muted num">
          {sale.number} · {formatDateTime(sale.createdAt)}
        </p>
        <p className="sale-total num">{formatMoney(sale.total, sale.currency)}</p>
        <p className="muted num">{equivalents(sale.total, sale.currency, sale.rates)}</p>
        {sale.customer && (
          <p className="muted">
            {t("sale.customer")}: {sale.customer.name}
            {sale.customer.doc && <span className="num"> · {sale.customer.doc}</span>}
          </p>
        )}
      </div>

      {sale.change.length > 0 && (
        <div className="sale-change">
          <span className="sale-change-label">{t("sale.change")}</span>
          {sale.change.map((entry, index) => (
            <span key={index} className="sale-change-line">
              <strong className="num">{formatMoney(entry.amount, entry.currency)}</strong>
              <span className="muted">{entry.methodName}</span>
            </span>
          ))}
        </div>
      )}

      <ul className="sale-lines">
        {sale.lines.map((line, index) => (
          <li key={index}>
            <span>
              {line.quantity} × {line.description}
            </span>
            <span className="num">{formatMoney(line.total + line.share, sale.currency)}</span>
          </li>
        ))}
        {sale.discount > 0 && (
          <li>
            <span>{t("receipt.discount")}</span>
            <span className="num">{formatMoney(-sale.discount, sale.currency)}</span>
          </li>
        )}
        {!sale.taxIncluded && sale.tax > 0 && (
          <li>
            <span>{sale.taxes.map((tax) => tax.name).filter(Boolean).join(" · ")}</span>
            <span className="num">{formatMoney(sale.tax, sale.currency)}</span>
          </li>
        )}
        {sale.payments.map((payment, index) => (
          <li key={`p${index}`} className="muted">
            <span>
              {payment.methodName}
              {payment.note && ` · ${t("receipt.ref", { note: payment.note })}`}
            </span>
            <span className="num">{formatMoney(payment.amount, payment.currency)}</span>
          </li>
        ))}
      </ul>
      {sale.note && <p className="muted">{sale.note}</p>}

      {extras.map((Extra, index) => (
        <Extra key={index} sale={sale} />
      ))}

      <ErrorNote>{error}</ErrorNote>
      {saved && (
        <p className="note note--info">
          {t("sale.saved", { file: saved })}{" "}
          <button type="button" className="link" onClick={() => void call<void>(APP.showFile, saved)}>
            {t("sale.show")}
          </button>
        </p>
      )}
    </Dialog>
  );
}
