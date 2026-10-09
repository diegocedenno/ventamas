import { Search } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { formatMoney } from "../../../renderer/src/lib/format";
import { priceRange, type Product, type Variant } from "../../inventario/api";
import { inventario } from "../../inventario/renderer/client";
import { t } from "./texts";

interface ProductSearchProps {
  inputRef: RefObject<HTMLInputElement | null>;
  /** Se eligió un producto: quien lo recibe decide si hace falta elegir la pieza. */
  onChoose(product: Product): void;
  /** Se leyó el código exacto de una pieza: se añade sin preguntar. */
  onAdd(product: Product, variant: Variant): void;
}

/** "$ 45,00", "desde $ 15,00" o "Precio al cobrar". */
export function priceLabel(product: Product): string {
  if (product.openPrice) return t("price.open");
  const { min, max } = priceRange(product);
  const price = formatMoney(min, product.currency);
  return max > min ? t("price.from", { price }) : price;
}

/** "6 en existencia", "Sin existencias" o "Servicio". */
export function stockLabel(product: Product): { text: string; out: boolean } {
  if (product.kind === "servicio") return { text: t("search.service"), out: false };
  const stock = product.variants.reduce((sum, variant) => sum + variant.stock, 0);
  return stock > 0 ? { text: t("search.stock", { count: stock }), out: false } : { text: t("search.nostock"), out: true };
}

/** El buscador de la venta: por nombre con el teclado, o por código con el lector. */
export function ProductSearch({ inputRef, onChoose, onAdd }: ProductSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Product[] | null>(null);
  const [highlight, setHighlight] = useState(0);
  const ticket = useRef(0);

  useEffect(() => {
    const text = query.trim();
    const current = ++ticket.current;
    if (text === "") {
      setResults(null);
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const found = await inventario.search(text);
        if (current !== ticket.current) return;
        setResults(found.products);
        setHighlight(0);
      } catch {
        if (current === ticket.current) setResults([]);
      }
    }, 120);
    return () => window.clearTimeout(timer);
  }, [query]);

  function clear() {
    ticket.current++;
    setQuery("");
    setResults(null);
    inputRef.current?.focus();
  }

  function pick(product: Product) {
    clear();
    onChoose(product);
  }

  async function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results?.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((current) => (current + step + results.length) % results.length);
    } else if (event.key === "Escape") {
      if (query !== "") {
        event.preventDefault();
        clear();
      }
    } else if (event.key === "Enter") {
      event.preventDefault();
      const text = query.trim();
      if (text === "") return;
      // Un lector de códigos teclea y pulsa Enter de golpe: se busca ya, sin esperar.
      const current = ++ticket.current;
      try {
        const found = await inventario.search(text);
        if (current !== ticket.current) return;
        const exact = found.exact;
        const product = exact ? found.products.find((p) => p.id === exact.productId) : undefined;
        const variant = exact ? product?.variants.find((v) => v.id === exact.variantId) : undefined;
        if (product && variant) {
          clear();
          onAdd(product, variant);
          return;
        }
        // El resaltado solo vale si la lista en pantalla es la de esta misma búsqueda.
        const chosen = (results && results[highlight] && found.products.find((p) => p.id === results[highlight]?.id)) ?? found.products[0];
        if (chosen) pick(chosen);
        // Lo que no se encontró queda escrito y avisado: no desaparece solo.
        else setResults([]);
      } catch {
        setResults([]);
      }
    }
  }

  const open = results !== null && query.trim() !== "";

  return (
    <div className="pos-search">
      <label className="search">
        <Search size={20} strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">{t("search.label")}</span>
        <input
          ref={inputRef}
          className="input input--search pos-search-input"
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls="pos-results"
          aria-activedescendant={open && results?.[highlight] ? `pos-result-${results[highlight].id}` : undefined}
          aria-autocomplete="list"
          value={query}
          placeholder={t("search.placeholder")}
          autoComplete="off"
          spellCheck={false}
          autoFocus
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => void onKeyDown(event)}
        />
      </label>
      {open && (
        <ul className="pos-results" id="pos-results" role="listbox" aria-label={t("search.label")}>
          {results.length === 0 && (
            <li className="pos-results-none" role="alert">
              {t("search.none", { query: query.trim() })}
            </li>
          )}
          {results.map((product, index) => {
            const stock = stockLabel(product);
            return (
              <li
                key={product.id}
                id={`pos-result-${product.id}`}
                role="option"
                aria-selected={index === highlight}
                className="pos-result"
                // mousedown: el clic no debe quitarle el foco al buscador antes de elegir.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => pick(product)}
                onMouseEnter={() => setHighlight(index)}
              >
                <span className="pos-result-name">
                  {product.name}
                  {product.category && <span className="muted"> · {product.category}</span>}
                </span>
                <span className={stock.out ? "pos-result-out" : "muted"}>{stock.text}</span>
                <span className="num pos-result-price">{priceLabel(product)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
