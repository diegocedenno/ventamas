import { convert, CURRENCIES, formatRate, money } from "@shared/money";
import { formatMoney } from "../../../renderer/src/lib/format";
import { formatTaxRate } from "../../impuestos/api";
import type { Sale } from "../../ventas/api";
import { formatInvoiceDate, type Invoice } from "../api";
import { t } from "./texts";

interface InvoiceDocumentProps {
  invoice: Invoice;
  sale: Sale;
  /** Milímetros que ocupa arriba el encabezado preimpreso de la forma. */
  top: number;
  /** Imprimir los datos de la tienda (si la forma no los trae). */
  header: boolean;
  /** Copia de archivo: se marca como tal, porque la factura es la hoja impresa. */
  copy?: boolean;
}

/**
 * La factura para imprimir sobre una forma libre. La imprenta ya puso en la hoja el número
 * de control, el RIF de la tienda y sus propios datos; aquí va lo demás: la palabra
 * "Factura", su número, la fecha, el cliente, lo vendido y los totales por tasa.
 *
 * Los montos de cada línea van sin impuesto, de modo que suman la base imponible.
 */
export function InvoiceDocument({ invoice, sale, top, header, copy = false }: InvoiceDocumentProps) {
  const { currency } = sale;
  const local = sale.rates.pivot;
  const formal = invoice.issuer.regime === "formal";
  const show = (amount: number) => formatMoney(amount, currency);
  const inLocal = (amount: number) => formatMoney(convert(money(amount, currency), local, sale.rates).amount, local);
  // Con el impuesto incluido en el precio, el monto de la línea es lo cobrado menos su impuesto.
  const amountOf = (line: Sale["lines"][number]) => (formal || !sale.taxIncluded ? line.total : line.total - line.tax);
  const taxed = sale.taxes.filter((tax) => tax.rate > 0);
  const exempt = sale.taxes.filter((tax) => tax.rate === 0).reduce((sum, tax) => sum + tax.base, 0);
  const discounts = sale.lineDiscounts + sale.discount;
  const rate = sale.rates.rates[currency];

  return (
    <div className="sheet" style={{ paddingTop: copy ? undefined : `${top}mm` }}>
      {copy && (
        <div className="sheet-copy">
          <p>{t("doc.copy")}</p>
          <p>{t("doc.copy.note", { control: invoice.control })}</p>
        </div>
      )}

      <div className="sheet-head">
        <div className="sheet-issuer">
          {(header || copy) && (
            <>
              <p className="sheet-name">{invoice.issuer.name}</p>
              <p>
                {t("doc.rif")}: {invoice.issuer.taxId}
              </p>
              <p>{invoice.issuer.address}</p>
              {invoice.issuer.phone && <p>{invoice.issuer.phone}</p>}
            </>
          )}
          {formal && <p className="sheet-legend">{t("doc.formal")}</p>}
        </div>
        <div className="sheet-id">
          <p className="sheet-title">{t("doc.title")}</p>
          <p className="sheet-number">
            {t("doc.number")} {invoice.number}
          </p>
          <p>
            {t("doc.date")}: {formatInvoiceDate(invoice.issuedOn)}
          </p>
        </div>
      </div>

      <dl className="sheet-customer">
        <div>
          <dt>{t("doc.customer")}</dt>
          <dd>{invoice.customer.name}</dd>
        </div>
        <div>
          <dt>{t("doc.customer.doc")}</dt>
          <dd>{invoice.customer.doc}</dd>
        </div>
        {invoice.customer.address && (
          <div className="sheet-wide">
            <dt>{t("doc.customer.address")}</dt>
            <dd>{invoice.customer.address}</dd>
          </div>
        )}
        {invoice.customer.phone && (
          <div>
            <dt>{t("doc.customer.phone")}</dt>
            <dd>{invoice.customer.phone}</dd>
          </div>
        )}
      </dl>

      <table className="sheet-lines">
        <thead>
          <tr>
            <th className="sheet-qty">{t("doc.qty")}</th>
            <th>{t("doc.description")}</th>
            <th className="sheet-amount">{t("doc.amount")}</th>
          </tr>
        </thead>
        <tbody>
          {sale.lines.map((line, index) => (
            <tr key={index}>
              <td className="sheet-qty">{line.quantity}</td>
              <td>
                {line.description}
                {!formal && line.taxRate === 0 && " (E)"}
              </td>
              <td className="sheet-amount">{show(amountOf(line))}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="sheet-foot">
        <div className="sheet-notes">
          {discounts > 0 && (
            <p>
              {t("doc.discounts")}: {show(discounts)}
            </p>
          )}
          {sale.payments.length > 0 && (
            <p>
              {t("doc.paid")}: {sale.payments.map((payment) => `${payment.methodName} ${formatMoney(payment.amount, payment.currency)}`).join(" · ")}
            </p>
          )}
          <p>{t("doc.sale", { number: sale.number })}</p>
          {sale.note && <p>{sale.note}</p>}
        </div>

        <table className="sheet-totals">
          <tbody>
            {!formal &&
              taxed.map((tax) => (
                <tr key={`base-${tax.id}`}>
                  <th>{t("doc.base", { rate: formatTaxRate(tax.rate) })}</th>
                  <td>{show(tax.base)}</td>
                </tr>
              ))}
            {!formal &&
              taxed.map((tax) => (
                <tr key={`tax-${tax.id}`}>
                  <th>{t("doc.tax", { name: tax.name, rate: formatTaxRate(tax.rate) })}</th>
                  <td>{show(tax.tax)}</td>
                </tr>
              ))}
            {!formal && exempt > 0 && (
              <tr>
                <th>{t("doc.exempt")}</th>
                <td>{show(exempt)}</td>
              </tr>
            )}
            <tr className="sheet-total">
              <th>{t("doc.total")}</th>
              <td>{show(sale.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Lo pactado en divisa se expresa también en moneda local, con su tipo de cambio. */}
      {currency !== local && rate !== undefined && (
        <div className="sheet-local">
          <p>{t("doc.rate", { rate: `${CURRENCIES[local].symbol} ${formatRate(rate)} por 1 ${CURRENCIES[currency].symbol}` })}</p>
          <p>
            {!formal &&
              taxed.map((tax) => (
                <span key={tax.id}>
                  {t("doc.base", { rate: formatTaxRate(tax.rate) })}: {inLocal(tax.base)} · {t("doc.tax", { name: tax.name, rate: formatTaxRate(tax.rate) })}:{" "}
                  {inLocal(tax.tax)} ·{" "}
                </span>
              ))}
            {!formal && exempt > 0 && (
              <span>
                {t("doc.exempt")}: {inLocal(exempt)} ·{" "}
              </span>
            )}
            <strong>
              {t("doc.total")}: {inLocal(sale.total)}
            </strong>
          </p>
        </div>
      )}
    </div>
  );
}
