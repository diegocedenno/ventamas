import { convert, CURRENCIES, formatRate, money, type CurrencyCode, type RateTable } from "@shared/money";
import type { Settings } from "@shared/settings";
import { formatDateTime, formatMoney } from "../../../renderer/src/lib/format";
import { formatTaxRate } from "../../impuestos/api";
import type { Sale } from "../api";
import { t } from "./texts";

/** Las otras monedas en las que se puede expresar un monto con esas tasas. */
export function otherCurrencies(currency: CurrencyCode, table: RateTable): CurrencyCode[] {
  const all = [table.pivot, ...(Object.keys(table.rates) as CurrencyCode[])];
  return all.filter((code, index) => code !== currency && all.indexOf(code) === index);
}

/** "Bs 56.326,40 · € 57,83": el mismo monto en las demás monedas. */
export function equivalents(amount: number, currency: CurrencyCode, table: RateTable): string {
  return otherCurrencies(currency, table)
    .map((code) => {
      const converted = convert(money(amount, currency), code, table);
      return formatMoney(converted.amount, converted.currency);
    })
    .join(" · ");
}

const percent = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });

/** Los datos de la tienda que encabezan sus documentos. */
export type StoreHeader = Pick<Settings, "store.name" | "store.legalName" | "store.taxId" | "store.address" | "store.phone">;

/** El recibo de una venta, en formato de papel térmico. No es una factura. */
export function ReceiptDocument({ sale, store }: { sale: Sale; store: StoreHeader }) {
  const rates = Object.entries(sale.rates.rates) as Array<[CurrencyCode, number]>;
  const name = store["store.name"] || store["store.legalName"];
  const discounted = sale.lineDiscounts > 0 || sale.discount > 0;
  return (
    <div className="doc">
      <div className="doc-center">
        {name && <p className="doc-store">{name}</p>}
        {store["store.taxId"] && <p className="doc-small">{store["store.taxId"]}</p>}
        {store["store.address"] && <p className="doc-small">{store["store.address"]}</p>}
        {store["store.phone"] && <p className="doc-small">{store["store.phone"]}</p>}
        <p className="doc-tag">{t("receipt.tag")}</p>
      </div>
      <hr className="doc-rule" />
      <p className="doc-row">
        <span>{sale.number}</span>
        <span>{formatDateTime(sale.createdAt)}</span>
      </p>
      {sale.customer && (
        <p className="doc-small">
          {t("receipt.customer")}: {sale.customer.name}
          {sale.customer.doc && ` · ${sale.customer.doc}`}
        </p>
      )}
      <hr className="doc-rule" />

      {sale.lines.map((line, index) => (
        <div className="doc-line" key={index}>
          <p>
            {line.description}
            {line.taxCode && ` (${line.taxCode})`}
          </p>
          <p className="doc-row">
            <span>
              {line.quantity} × {formatMoney(line.unitPrice, sale.currency)}
            </span>
            <span>{formatMoney(line.unitPrice * line.quantity, sale.currency)}</span>
          </p>
          {line.discount > 0 && (
            <p className="doc-row doc-small">
              <span>{t("receipt.discount")}</span>
              <span>{formatMoney(-line.discount, sale.currency)}</span>
            </p>
          )}
        </div>
      ))}

      <hr className="doc-rule" />
      {(discounted || (!sale.taxIncluded && sale.tax > 0)) && (
        <p className="doc-row">
          <span>{t("receipt.subtotal")}</span>
          <span>{formatMoney(sale.subtotal - sale.lineDiscounts, sale.currency)}</span>
        </p>
      )}
      {sale.discount > 0 && (
        <p className="doc-row">
          <span>
            {t("receipt.discount")}
            {sale.discountPercent !== null && ` ${percent.format(sale.discountPercent / 100)} %`}
          </span>
          <span>{formatMoney(-sale.discount, sale.currency)}</span>
        </p>
      )}
      {sale.taxes.map((tax) => (
        <p className="doc-row doc-small" key={tax.id}>
          <span>
            {tax.code && `(${tax.code}) `}
            {tax.rate > 0
              ? `${t("tax.base", { name: formatTaxRate(tax.rate) })} ${formatMoney(tax.base, sale.currency)} · ${tax.name}`
              : `${tax.name || t("tax.exempt")}`}
          </span>
          <span>{formatMoney(tax.rate > 0 ? tax.tax : tax.base, sale.currency)}</span>
        </p>
      ))}
      <p className="doc-row doc-row--strong">
        <span>{t("receipt.total")}</span>
        <span>{formatMoney(sale.total, sale.currency)}</span>
      </p>
      {otherCurrencies(sale.currency, sale.rates).map((code) => {
        const converted = convert(money(sale.total, sale.currency), code, sale.rates);
        return (
          <p className="doc-row doc-small" key={code}>
            <span>{CURRENCIES[code].name}</span>
            <span>{formatMoney(converted.amount, code)}</span>
          </p>
        );
      })}

      {sale.payments.length > 0 && (
        <>
          <hr className="doc-rule" />
          <p className="doc-title">{t("receipt.paid")}</p>
          {sale.payments.map((payment, index) => (
            <p className="doc-row" key={index}>
              <span>
                {payment.methodName}
                {payment.note && ` (${t("receipt.ref", { note: payment.note })})`}
              </span>
              <span>{formatMoney(payment.amount, payment.currency)}</span>
            </p>
          ))}
        </>
      )}

      {sale.change.length > 0 && (
        <>
          <hr className="doc-rule" />
          <p className="doc-title">{t("receipt.change")}</p>
          {sale.change.map((entry, index) => (
            <p className="doc-row" key={index}>
              <span>{entry.methodName}</span>
              <span>{formatMoney(entry.amount, entry.currency)}</span>
            </p>
          ))}
        </>
      )}

      <hr className="doc-rule" />
      <p className="doc-small">
        {t("receipt.rate")}:{" "}
        {rates.map(([code, rate]) => `1 ${CURRENCIES[code].symbol} = ${CURRENCIES[sale.rates.pivot].symbol} ${formatRate(rate)}`).join(" · ")}
      </p>
      {sale.note && <p className="doc-small doc-note">{sale.note}</p>}
      <div className="doc-center doc-small">
        <p>{t("receipt.thanks")}</p>
        <p>{t("receipt.notice")}</p>
      </div>
    </div>
  );
}
