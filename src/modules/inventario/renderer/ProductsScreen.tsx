import { Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Empty, ErrorNote } from "../../../renderer/src/components/Fields";
import { formatMoney, plural } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { LIST_LIMIT, type Product } from "../api";
import { inventario } from "./client";
import { ProductEditor } from "./ProductEditor";
import { t } from "./texts";

export function ProductsScreen() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  // undefined: editor cerrado · null: producto nuevo · Product: edición
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [openError, setOpenError] = useState<string | null>(null);

  // La lista se filtra un instante después de dejar de teclear.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const products = useData(() => inventario.list(search, showInactive), [search, showInactive]);
  const list = products.data ?? [];
  const filtering = search.trim() !== "" || showInactive;

  async function open(id: string) {
    setOpenError(null);
    try {
      setEditing(await inventario.get(id));
    } catch (reason) {
      setOpenError(messageOf(reason));
      void products.reload();
    }
  }

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

      <div className="products-filters">
        <label className="search products-search">
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

      <ErrorNote>{products.error ?? openError}</ErrorNote>

      {products.data && list.length === 0 && !filtering && (
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

      {products.data && list.length === 0 && filtering && (
        <div className="card">
          <Empty title={t("none.title")}>{t("none.body")}</Empty>
        </div>
      )}

      {list.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t("col.product")}</th>
                <th className="right">{t("col.price")}</th>
                <th>{t("col.pieces")}</th>
                <th className="right">{t("col.stock")}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((product) => (
                <tr key={product.id} className="is-clickable" onClick={() => void open(product.id)}>
                  <td>
                    <button type="button" className="row-btn product-name" onClick={(event) => (event.stopPropagation(), void open(product.id))}>
                      {product.name}
                    </button>
                    <span className="product-meta">
                      {product.category && <span className="muted">{product.category}</span>}
                      {!product.active && <span className="badge">{t("inactive")}</span>}
                    </span>
                  </td>
                  <td className="right num">{formatMoney(product.price, product.currency)}</td>
                  <td className="muted">
                    {product.variantCount > 1 ? plural(product.variantCount, "combinación", "combinaciones") : t("pieces.single")}
                  </td>
                  <td className="right">
                    <span className="num">{product.stock}</span>
                    {product.needsReview && <span className="badge badge--warn product-review">{t("review")}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {list.length >= LIST_LIMIT && <p className="muted">{t("limit", { count: LIST_LIMIT })}</p>}

      {editing !== undefined && (
        <ProductEditor product={editing} onClose={() => setEditing(undefined)} onChanged={() => void products.reload()} />
      )}
    </div>
  );
}
