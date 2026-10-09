import { useState } from "react";
import { Chip } from "../../../renderer/src/components/Choices";
import { Empty, ErrorNote } from "../../../renderer/src/components/Fields";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import { BROWSE_LIMIT, type Product } from "../../inventario/api";
import { inventario } from "../../inventario/renderer/client";
import { priceLabel, stockLabel } from "./ProductSearch";
import { t } from "./texts";

interface BrowseProps {
  onChoose(product: Product): void;
  /** Cambia tras cada venta: las existencias de los mosaicos se vuelven a leer. */
  refresh: number;
}

/**
 * Los productos a la vista, por categoría, para venderlos con un toque. Acompaña al
 * buscador: es lo cómodo para pocos productos, servicios y pantallas táctiles.
 */
export function Browse({ onChoose, refresh }: BrowseProps) {
  const { goTo } = useApp();
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const categories = useData(() => inventario.categories(), [refresh]);
  const products = useData(() => inventario.browse(categoryId), [categoryId, refresh]);

  const used = (categories.data ?? []).filter((category) => category.productCount > 0);
  const list = products.data ?? [];
  const error = products.error ?? categories.error;

  if (products.data && list.length === 0 && categoryId === null) {
    return (
      <div className="card">
        <Empty
          title={t("browse.empty.title")}
          action={
            <button type="button" className="btn btn--primary" onClick={() => goTo("productos")}>
              {t("browse.empty.action")}
            </button>
          }
        >
          {t("browse.empty.body")}
        </Empty>
      </div>
    );
  }

  return (
    <section className="browse" aria-label={t("browse.title")}>
      {used.length > 1 && (
        <div className="chips" role="group" aria-label={t("browse.title")}>
          <Chip pressed={categoryId === null} onClick={() => setCategoryId(null)}>
            {t("browse.all")}
          </Chip>
          {used.map((category) => (
            <Chip key={category.id} pressed={categoryId === category.id} onClick={() => setCategoryId(category.id)}>
              {category.name}
            </Chip>
          ))}
        </div>
      )}
      <ErrorNote>{error}</ErrorNote>
      {products.data && list.length === 0 && <p className="muted">{t("browse.category.empty")}</p>}
      <div className="tiles">
        {list.map((product) => {
          const stock = stockLabel(product);
          return (
            <button key={product.id} type="button" className="tile" onClick={() => onChoose(product)}>
              <span className="tile-name">{product.name}</span>
              <span className="tile-foot">
                <span className="tile-price num">{priceLabel(product)}</span>
                <span className={stock.out ? "tile-stock tile-stock--out" : "tile-stock"}>{stock.text}</span>
              </span>
            </button>
          );
        })}
      </div>
      {list.length >= BROWSE_LIMIT && <p className="muted">{t("browse.more")}</p>}
    </section>
  );
}
