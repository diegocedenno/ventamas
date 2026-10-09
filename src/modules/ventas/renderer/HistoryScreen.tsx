import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Segmented } from "../../../renderer/src/components/Choices";
import { Empty, ErrorNote } from "../../../renderer/src/components/Fields";
import { formatDateTime, formatMoney } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import { HISTORY_LIMIT, type Sale } from "../api";
import { ventas } from "./client";
import { SaleDialog } from "./SaleDialog";
import { t } from "./texts";

type Period = "today" | "week" | "month" | "all";

const pad = (value: number) => String(value).padStart(2, "0");
const dayOf = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** El primer día de un periodo, como día de la tienda; null si es todo el historial. */
function startOf(period: Period, now = new Date()): string | null {
  if (period === "all") return null;
  if (period === "today") return dayOf(now);
  if (period === "week") return dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6));
  return dayOf(new Date(now.getFullYear(), now.getMonth(), 1));
}

/** El historial de ventas: por periodo, por cliente o buscando un número. Cada venta se puede abrir y reimprimir. */
export function HistoryScreen() {
  const { params, goTo } = useApp();
  // Si se llega desde la ficha de un cliente, se ven sus compras de siempre.
  const customerId = params.customerId ?? null;
  const [period, setPeriod] = useState<Period>(customerId ? "all" : "today");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const page = useData(() => ventas.list({ from: startOf(period), query: search, customerId }), [period, search, customerId]);
  const sales = page.data?.sales ?? [];
  const filtering = search.trim() !== "" || period !== "all" || customerId !== null;

  async function view(id: string) {
    setError(null);
    try {
      setViewing(await ventas.get(id));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  return (
    <div className="page page--wide">
      <header className="page-head">
        <h1 className="page-title">{t("history.title")}</h1>
      </header>

      <div className="history-filters">
        <label className="search history-search">
          <Search size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{t("history.search")}</span>
          <input
            className="input input--search"
            type="search"
            value={query}
            placeholder={t("history.search")}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <Segmented
          label={t("history.period")}
          value={period}
          options={[
            { value: "today", label: t("history.period.today") },
            { value: "week", label: t("history.period.week") },
            { value: "month", label: t("history.period.month") },
            { value: "all", label: t("history.period.all") },
          ]}
          onChange={setPeriod}
        />
      </div>

      {customerId && (
        <p className="history-customer">
          <span className="badge badge--accent">{t("history.customer", { name: params.customerName ?? "" })}</span>
          <button type="button" className="icon-btn" aria-label={t("history.customer.clear")} title={t("history.customer.clear")} onClick={() => goTo("historial")}>
            <X size={18} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </p>
      )}

      <ErrorNote>{page.error ?? error}</ErrorNote>

      {page.data && page.data.count > 0 && (
        <div className="stats">
          <div className="stat">
            <span className="stat-label">{t("history.sold")}</span>
            {page.data.totals.map((total) => (
              <span className="stat-value num" key={total.currency}>
                {formatMoney(total.amount, total.currency)}
              </span>
            ))}
            <span className="stat-note num">{page.data.count === 1 ? t("history.count.one") : t("history.count", { count: page.data.count })}</span>
          </div>
        </div>
      )}

      {page.data && sales.length === 0 && (
        <div className="card">
          {filtering ? (
            <Empty title={t("history.empty.title")}>{t("history.empty.body")}</Empty>
          ) : (
            <Empty title={t("history.none.title")}>{t("history.none.body")}</Empty>
          )}
        </div>
      )}

      {sales.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("list.col.number")}</th>
                <th>{t("list.col.date")}</th>
                <th>{t("list.col.customer")}</th>
                <th className="right">{t("list.col.pieces")}</th>
                <th className="right">{t("list.col.total")}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((item) => (
                <tr key={item.id} className="is-clickable" onClick={() => void view(item.id)}>
                  <td>
                    <button
                      type="button"
                      className="row-btn num history-number"
                      aria-label={t("list.view.label", { number: item.number })}
                      onClick={(event) => (event.stopPropagation(), void view(item.id))}
                    >
                      {item.number}
                    </button>
                  </td>
                  <td className="num">{formatDateTime(item.createdAt)}</td>
                  <td>{item.customerName}</td>
                  <td className="right num">{item.pieces}</td>
                  <td className="right num">{formatMoney(item.total, item.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {page.data && page.data.count > HISTORY_LIMIT && <p className="muted">{t("history.limit", { count: HISTORY_LIMIT })}</p>}

      {viewing && <SaleDialog sale={viewing} fresh={false} onClose={() => setViewing(null)} />}
    </div>
  );
}
