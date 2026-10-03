import { useState } from "react";
import { APP } from "@shared/api";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { usePrint } from "../../../renderer/src/components/Print";
import { formatDateTime, formatMoney } from "../../../renderer/src/lib/format";
import { call, messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import type { MethodTotals, SessionSummary } from "../api";
import { t } from "./texts";

/** Diferencia entre lo contado y lo esperado, en palabras. */
export function Difference({ line }: { line: MethodTotals }) {
  if (line.counted === null) return <span className="muted">—</span>;
  const difference = line.counted - line.expected;
  if (difference === 0) return <span className="badge badge--accent">{t("close.match")}</span>;
  return (
    <span className="badge badge--warn num">
      {difference > 0 ? t("close.over") : t("close.short")} {formatMoney(Math.abs(difference), line.method.currency)}
    </span>
  );
}

/** Solo los medios que tuvieron algún movimiento o se contaron. */
export const usedLines = (summary: SessionSummary): MethodTotals[] =>
  summary.totals.filter((line) => line.expected !== 0 || line.counted !== null || line.opening !== 0 || line.sales !== 0);

/** El cierre de una caja en formato de recibo, para imprimirlo. */
export function CloseDocument({ summary, storeName }: { summary: SessionSummary; storeName: string }) {
  return (
    <div className="doc">
      <div className="doc-center">
        {storeName && <p className="doc-store">{storeName}</p>}
        <p className="doc-tag">{t("report.nonfiscal")}</p>
      </div>
      <hr className="doc-rule" />
      <p className="doc-row">
        <span>{t("report.opened")}</span>
        <span>{formatDateTime(summary.openedAt)}</span>
      </p>
      {summary.closedAt && (
        <p className="doc-row">
          <span>{t("report.closed")}</span>
          <span>{formatDateTime(summary.closedAt)}</span>
        </p>
      )}
      <p className="doc-row">
        <span>{t("stat.sales")}</span>
        <span>{summary.salesCount}</span>
      </p>
      {summary.salesTotals.map((total) => (
        <p className="doc-row doc-row--strong" key={total.currency}>
          <span>{t("stat.total")}</span>
          <span>{formatMoney(total.amount, total.currency)}</span>
        </p>
      ))}
      <hr className="doc-rule" />
      {usedLines(summary).map((line) => {
        const { currency } = line.method;
        const difference = line.counted === null ? null : line.counted - line.expected;
        return (
          <div className="doc-line" key={line.method.id}>
            <p className="doc-title">{line.method.name}</p>
            <p className="doc-row">
              <span>{t("col.expected")}</span>
              <span>{formatMoney(line.expected, currency)}</span>
            </p>
            {line.counted !== null && (
              <p className="doc-row">
                <span>{t("col.counted")}</span>
                <span>{formatMoney(line.counted, currency)}</span>
              </p>
            )}
            {difference !== null && difference !== 0 && (
              <p className="doc-row">
                <span>{difference > 0 ? t("close.over") : t("close.short")}</span>
                <span>{formatMoney(Math.abs(difference), currency)}</span>
              </p>
            )}
          </div>
        );
      })}
      {summary.note && (
        <>
          <hr className="doc-rule" />
          <p className="doc-small">
            {t("report.note")}: {summary.note}
          </p>
        </>
      )}
    </div>
  );
}

/** El cierre de una caja en pantalla, con la opción de imprimirlo o guardarlo. */
export function CloseReport({ summary, onClose }: { summary: SessionSummary; onClose(): void }) {
  const { settings } = useApp();
  const printer = usePrint();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const width = settings["receipt.width"];
  const document = <CloseDocument summary={summary} storeName={settings["store.name"]} />;

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

  // Nombre del archivo con la fecha y hora del equipo: cierre-2026-10-05-18-30
  const when = new Date(summary.closedAt ?? summary.openedAt);
  const pad = (n: number) => String(n).padStart(2, "0");
  const name = `cierre-${when.getFullYear()}-${pad(when.getMonth() + 1)}-${pad(when.getDate())}-${pad(when.getHours())}-${pad(when.getMinutes())}`;

  return (
    <Dialog
      title={t("report.title")}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" disabled={busy} onClick={() => void run(() => printer.savePdf(document, width, name))}>
            {t("report.pdf")}
          </button>
          <button type="button" className="btn" disabled={busy} onClick={() => void run(() => printer.print(document, width))}>
            {t("report.print")}
          </button>
          <button type="button" className="btn btn--primary" onClick={onClose}>
            {t("report.done")}
          </button>
        </>
      }
    >
      <dl className="facts">
        <div>
          <dt>{t("report.opened")}</dt>
          <dd>{formatDateTime(summary.openedAt)}</dd>
        </div>
        {summary.closedAt && (
          <div>
            <dt>{t("report.closed")}</dt>
            <dd>{formatDateTime(summary.closedAt)}</dd>
          </div>
        )}
        <div>
          <dt>{t("stat.sales")}</dt>
          <dd className="num">
            {summary.salesCount}
            {summary.salesTotals.map((total) => ` · ${formatMoney(total.amount, total.currency)}`)}
          </dd>
        </div>
        {summary.note && (
          <div>
            <dt>{t("report.note")}</dt>
            <dd>{summary.note}</dd>
          </div>
        )}
      </dl>

      <div className="table-wrap">
        <table className="table table--compact">
          <thead>
            <tr>
              <th>{t("col.method")}</th>
              <th className="right">{t("col.expected")}</th>
              <th className="right">{t("col.counted")}</th>
              <th>{t("col.difference")}</th>
            </tr>
          </thead>
          <tbody>
            {usedLines(summary).map((line) => (
              <tr key={line.method.id}>
                <td>{line.method.name}</td>
                <td className="right num">{formatMoney(line.expected, line.method.currency)}</td>
                <td className="right num">
                  {line.counted === null ? "—" : formatMoney(line.counted, line.method.currency)}
                </td>
                <td>
                  <Difference line={line} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ErrorNote>{error}</ErrorNote>
      {saved && (
        <p className="note note--info">
          {t("report.saved", { file: saved })}{" "}
          <button type="button" className="link" onClick={() => void call<void>(APP.showFile, saved)}>
            {t("report.show")}
          </button>
        </p>
      )}
    </Dialog>
  );
}
