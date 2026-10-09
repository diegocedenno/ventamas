import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, ErrorNote } from "../../../renderer/src/components/Fields";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import { CUSTOMER_LIST_LIMIT, type Customer } from "../api";
import { clientes } from "./client";
import { CustomerEditor } from "./CustomerEditor";
import { t } from "./texts";

/** Pantalla de otro módulo que muestra las compras de un cliente, si la tienda la tiene. */
const PURCHASES_SCREEN = "historial";

export function CustomersScreen() {
  const { goTo, screens } = useApp();
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  // undefined: editor cerrado · null: cliente nuevo · Customer: edición
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);

  // La lista se filtra un instante después de dejar de teclear.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const customers = useData(() => clientes.list(search, showInactive), [search, showInactive]);
  const list = customers.data ?? [];
  const filtering = search.trim() !== "" || showInactive;
  const hasPurchases = screens.some((screen) => screen.id === PURCHASES_SCREEN);

  return (
    <div className="page page--wide">
      <header className="page-head">
        <h1 className="page-title">{t("title")}</h1>
        <div className="page-actions">
          <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>
            <Plus size={20} strokeWidth={2} aria-hidden="true" />
            {t("new")}
          </button>
        </div>
      </header>

      <div className="customers-filters">
        <label className="search customers-search">
          <Search size={20} strokeWidth={1.75} aria-hidden="true" />
          <span className="sr-only">{t("search")}</span>
          <input
            className="input input--search"
            type="search"
            value={query}
            placeholder={t("search")}
            autoComplete="off"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="check">
          <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
          {t("showInactive")}
        </label>
      </div>

      <ErrorNote>{customers.error}</ErrorNote>

      {customers.data && list.length === 0 && !filtering && (
        <div className="card">
          <Empty
            title={t("empty.title")}
            action={
              <button type="button" className="btn btn--primary" onClick={() => setEditing(null)}>
                <Plus size={20} strokeWidth={2} aria-hidden="true" />
                {t("new")}
              </button>
            }
          >
            {t("empty.body")}
          </Empty>
        </div>
      )}

      {customers.data && list.length === 0 && filtering && (
        <div className="card">
          <Empty title={t("none.title")}>{t("none.body")}</Empty>
        </div>
      )}

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.name")}</th>
                <th>{t("col.doc")}</th>
                <th>{t("col.phone")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((customer) => (
                <tr key={customer.id} className="is-clickable" onClick={() => setEditing(customer)}>
                  <td>
                    <button type="button" className="row-btn customer-name" onClick={(event) => (event.stopPropagation(), setEditing(customer))}>
                      {customer.name}
                    </button>
                    {!customer.active && <span className="badge">{t("inactive")}</span>}
                  </td>
                  <td className="num">{customer.doc}</td>
                  <td className="num">{customer.phone}</td>
                  <td className="right">
                    {hasPurchases && (
                      <button
                        type="button"
                        className="link"
                        aria-label={t("purchases.label", { name: customer.name })}
                        onClick={(event) => (event.stopPropagation(), goTo(PURCHASES_SCREEN, { customerId: customer.id, customerName: customer.name }))}
                      >
                        {t("purchases")}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length >= CUSTOMER_LIST_LIMIT && <p className="muted">{t("limit", { count: CUSTOMER_LIST_LIMIT })}</p>}

      {editing !== undefined && <CustomerEditor customer={editing} onClose={() => setEditing(undefined)} onSaved={() => void customers.reload()} />}
    </div>
  );
}
