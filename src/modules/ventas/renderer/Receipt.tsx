import { convert, CURRENCIES, formatRate, money, type CurrencyCode, type RateTable } from "@shared/money";
import { formatDateTime, formatMoney } from "../../../renderer/src/lib/format";
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

/** El recibo de una venta, en formato de papel térmico. No es una factura. */
export function ReceiptDocument({ sale, storeName }: { sale: Sale; storeName: string }) {
  const rates = Object.entries(sale.rates.rates) as Array<[CurrencyCode, number]>;
  return (
    <div className="doc">
      <div className="doc-center">
        {storeName && <p className="doc-store">{storeName}</p>}
        <p className="doc-tag">{t("receipt.tag")}</p>
      </div>
      <hr className="doc-rule" />
      <p className="doc-row">
        <span>{sale.number}</span>
        <span>{formatDateTime(sale.createdAt)}</span>
      </p>
      <hr className="doc-rule" />

      {sale.lines.map((line, index) => (
        <div className="doc-line" key={index}>
          <p>{line.description}</p>
          <p className="doc-row">
            <span>
              {line.quantity} × {formatMoney(line.unitPrice, sale.currency)}
            </span>
            <span>{formatMoney(line.total, sale.currency)}</span>
          </p>
        </div>
      ))}

      <hr className="doc-rule" />
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
      <div className="doc-center doc-small">
        <p>{t("receipt.thanks")}</p>
        <p>{t("receipt.notice")}</p>
      </div>
    </div>
  );
}
