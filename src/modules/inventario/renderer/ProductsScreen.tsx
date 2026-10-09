import { Boxes, Plus, Search } from "lucide-react";
import { useEffect, useState } from "react";
import { Segmented } from "../../../renderer/src/components/Choices";
import { Empty, ErrorNote } from "../../../renderer/src/components/Fields";
import { formatMoney, plural } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { LIST_LIMIT, type Product, type ProductKind, type ProductSummary } from "../api";
import { inventario } from "./client";
import { ProductEditor } from "./ProductEditor";
import { StockDialog } from "./StockDialog";
import { t } from "./texts";

type KindFilter = "all" | ProductKind;
type Attention = "low" | "negative" | null;

const whole = new Intl.NumberFormat("es-VE");

export function ProductsScreen() {
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [kind, setKind] = useState<KindFilter>("all");
  const [categoryId, setCategoryId] = useState("");
  const [attention, setAttention] = useState<Attention>(null);
  // undefined: editor cerrado · null: producto nuevo · Product: edición
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [stockOf, setStockOf] = useState<Product | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);

  // La lista se filtra un instante después de dejar de teclear.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(query), 180);
    return () => window.clearTimeout(timer);
  }, [query]);

  const products = useData(
    () =>
      inventario.list({
        query: search,
        includeInactive: showInactive,
        categoryId: categoryId || null,
        kind: kind === "all" ? null : kind,
        lowOnly: attention === "low",
        negativeOnly: attention === "negative",
      }),
    [search, showInactive, categoryId, kind, attention]
  );
  const summary = useData(() => inventario.summary(), []);
  const categories = useData(() => inventario.categories(), []);

  const list = products.data ?? [];
  const filtering = search.trim() !== "" || showInactive || kind !== "all" || categoryId !== "" || attention !== null;
  const used = (categories.data ?? []).filter((category) => category.productCount > 0);
  const stats = summary.data;

  function reload() {
    void products.reload();
    void summary.reload();
    void categories.reload();
  }

  async function open(id: string, target: "editor" | "stock") {
    setOpenError(null);
    try {
      const product = await inventario.get(id);
      if (target === "editor") setEditing(product);
      else setStockOf(product);
    } catch (reason) {
      setOpenError(messageOf(reason));
      reload();
    }
  }

  const priceOf = (product: ProductSummary): string => {
    if (product.openPrice) return t("price.open");
    const price = formatMoney(product.price, product.currency);
    return product.priceMax > product.price ? t("price.from", { price }) : price;
  };

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

      {stats && stats.products + stats.services > 0 && (
        <div className="stats">
          <div className="stat">
            <span className="stat-label">{t("stat.products")}</span>
            <span className="stat-value num">{whole.format(stats.products)}</span>
            {stats.services > 0 && (
              <span className="stat-note">{stats.services === 1 ? t("stat.services.one") : t("stat.services", { count: stats.services })}</span>
            )}
          </div>
          <div className="stat">
            <span className="stat-label">{t("stat.pieces")}</span>
            <span className="stat-value num">{whole.format(stats.pieces)}</span>
          </div>
          <div className="stat">
            <span className="stat-label">{t("stat.value")}</span>
            <span className="stat-value num">{formatMoney(stats.saleValue, stats.currency)}</span>
            {stats.costValue > 0 && (
              <span className="stat-note num">
                {stats.withoutCost > 0
                  ? t("stat.cost.partial", { amount: formatMoney(stats.costValue, stats.currency), count: stats.withoutCost })
                  : t("stat.cost", { amount: formatMoney(stats.costValue, stats.currency) })}
              </span>
            )}
          </div>
          {stats.low > 0 && (
            <button
              type="button"
              className="stat stat--button"
              aria-pressed={attention === "low"}
              title={attention === "low" ? t("stat.filter.on") : undefined}
              onClick={() => setAttention(attention === "low" ? null : "low")}
            >
              <span className="stat-label">{t("stat.low")}</span>
              <span className="stat-value num">{whole.format(stats.low)}</span>
              <span className="stat-note">{t("stat.low.note")}</span>
            </button>
          )}
          {stats.negative > 0 && (
            <button
              type="button"
              className="stat stat--button"
              aria-pressed={attention === "negative"}
              title={attention === "negative" ? t("stat.filter.on") : undefined}
              onClick={() => setAttention(attention === "negative" ? null : "negative")}
            >
              <span className="stat-label">{t("stat.negative")}</span>
              <span className="stat-value num">{whole.format(stats.negative)}</span>
              <span className="stat-note">{t("stat.negative.note")}</span>
            </button>
          )}
        </div>
      )}

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
        {used.length > 1 && (
          <label className="products-category">
            <span className="sr-only">{t("filter.category")}</span>
            <select className="input select" value={categoryId} onChange={(event) => setCategoryId(event.target.value)}>
              <option value="">{t("filter.category.all")}</option>
              {used.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
        )}
        {stats && stats.services > 0 && stats.products > 0 && (
          <Segmented
            label={t("filter.kind")}
            value={kind}
            options={[
              { value: "all", label: t("filter.kind.all") },
              { value: "producto", label: t("filter.kind.products") },
              { value: "servicio", label: t("filter.kind.services") },
            ]}
            onChange={setKind}
          />
        )}
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
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((product) => {
                const service = product.kind === "servicio";
                return (
                  <tr key={product.id} className="is-clickable" onClick={() => void open(product.id, "editor")}>
                    <td>
                      <button
                        type="button"
                        className="row-btn product-name"
                        onClick={(event) => (event.stopPropagation(), void open(product.id, "editor"))}
                      >
                        {product.name}
                      </button>
                      <span className="product-meta">
                        {product.category && <span className="muted">{product.category}</span>}
                        {service && <span className="badge badge--accent">{t("service")}</span>}
                        {!product.active && <span className="badge">{t("inactive")}</span>}
                      </span>
                    </td>
                    <td className="right num">{priceOf(product)}</td>
                    <td className="muted">
                      {product.variantCount > 1 ? plural(product.variantCount, "variante", "variantes") : service ? t("pieces.none") : t("pieces.single")}
                    </td>
                    <td className="right">
                      {service ? (
                        <span className="muted">{t("pieces.none")}</span>
                      ) : (
                        <>
                          <span className="num">{whole.format(product.stock)}</span>
                          {product.needsReview && <span className="badge badge--warn product-review">{t("review")}</span>}
                          {!product.needsReview && product.low > 0 && <span className="badge badge--warn product-review">{t("low")}</span>}
                        </>
                      )}
                    </td>
                    <td className="products-actions">
                      {!service && (
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t("stock.action", { name: product.name })}
                          title={t("stock.action", { name: product.name })}
                          onClick={(event) => (event.stopPropagation(), void open(product.id, "stock"))}
                        >
                          <Boxes size={20} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {list.length >= LIST_LIMIT && <p className="muted">{t("limit", { count: LIST_LIMIT })}</p>}

      {editing !== undefined && <ProductEditor product={editing} onClose={() => setEditing(undefined)} onChanged={reload} />}
      {stockOf && <StockDialog product={stockOf} onClose={() => setStockOf(null)} onChanged={reload} />}
    </div>
  );
}
