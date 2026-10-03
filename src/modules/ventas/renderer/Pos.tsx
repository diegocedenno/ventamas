import { History, Minus, Plus, Search, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent, type RefObject } from "react";
import { money, parseAmount, type CurrencyCode, type RateTable } from "@shared/money";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { AmountInput, Empty, ErrorNote } from "../../../renderer/src/components/Fields";
import { formatMoney, formatTime, plainAmount } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useData } from "../../../renderer/src/lib/useData";
import { useApp } from "../../../renderer/src/state";
import type { PaymentMethod } from "../../caja/api";
import { describeVariant, type Product, type Variant } from "../../inventario/api";
import { inventario } from "../../inventario/renderer/client";
import { MAX_QUANTITY, PAYMENT_NOTE_MAX, type Sale } from "../api";
import { amountIn, settle } from "../settlement";
import { ventas } from "./client";
import { equivalents, otherCurrencies } from "./Receipt";
import { SaleDialog } from "./SaleDialog";
import { t } from "./texts";

interface CartLine {
  variantId: string;
  description: string;
  unitPrice: number;
  quantity: number;
  /** Existencias de la pieza cuando se añadió. */
  stock: number;
}

interface MoneyDraft {
  key: number;
  method: PaymentMethod;
  amount: number;
  note: string;
}

interface PosProps {
  currency: CurrencyCode;
  table: RateTable;
  /** Medios de pago activos. */
  methods: PaymentMethod[];
  sessionId: string;
}

let nextKey = 1;

/** Toda la venta en una pantalla: buscar, armar la venta, cobrar en varias monedas y dar el vuelto. */
export function Pos({ currency, table, methods, sessionId }: PosProps) {
  const { goTo } = useApp();
  const [cart, setCart] = useState<CartLine[]>([]);
  const [payments, setPayments] = useState<MoneyDraft[]>([]);
  // null: el vuelto se propone solo. Una lista: quien cobra lo repartió a mano.
  const [manualChange, setManualChange] = useState<MoneyDraft[] | null>(null);
  const [entry, setEntry] = useState<{ method: PaymentMethod; mode: "pago" | "vuelto" } | null>(null);
  const [picker, setPicker] = useState<Product | null>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [showSales, setShowSales] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const searchInput = useRef<HTMLInputElement>(null);
  const firstMethod = useRef<HTMLButtonElement>(null);
  const chargeButton = useRef<HTMLButtonElement>(null);

  const total = cart.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);

  /* ---------- la cuenta ---------- */

  const result = useMemo(() => {
    const paid = payments.map((p) => ({ ...p, currency: p.method.currency }));
    const before = settle(money(total, currency), paid, [], table);

    // Vuelto propuesto: en el mismo efectivo con que se pagó de más o, si no, en el de la moneda de los precios.
    let change = manualChange;
    if (change === null) {
      change = [];
      if (before.changeDue > 0) {
        const last = payments.at(-1)?.method;
        const cash = methods.filter((m) => m.kind === "efectivo");
        const method = (last?.kind === "efectivo" ? last : undefined) ?? cash.find((m) => m.currency === currency) ?? cash[0];
        if (method) {
          change = [{ key: 0, method, amount: amountIn(before.changeValue, method.currency, table), note: "" }];
        }
      }
    }
    return settle(
      money(total, currency),
      paid,
      change.map((c) => ({ ...c, currency: c.method.currency })),
      table
    );
  }, [total, currency, table, payments, manualChange, methods]);

  const canCharge = cart.length > 0 && result.settled && !busy;

  // El foco va siempre a lo siguiente: otro medio de pago o, si la cuenta ya cuadra, el botón de cobrar.
  const focusNext = useCallback(() => {
    window.setTimeout(() => {
      const charge = chargeButton.current;
      if (charge && !charge.disabled) charge.focus();
      else firstMethod.current?.focus();
    }, 0);
  }, []);

  // Al cerrarse el campo de monto (se agregó el pago o se canceló), el foco sigue su camino.
  const entering = useRef(false);
  useEffect(() => {
    if (entry) {
      entering.current = true;
    } else if (entering.current) {
      entering.current = false;
      focusNext();
    }
  }, [entry, focusNext]);

  /* ---------- armar la venta ---------- */

  const addVariant = useCallback((product: Product, variant: Variant) => {
    setCart((current) => {
      const existing = current.find((line) => line.variantId === variant.id);
      if (existing) {
        return current.map((line) =>
          line === existing ? { ...line, quantity: Math.min(line.quantity + 1, MAX_QUANTITY) } : line
        );
      }
      return [
        ...current,
        {
          variantId: variant.id,
          description: describeVariant(product.name, variant),
          unitPrice: product.price,
          quantity: 1,
          stock: variant.stock,
        },
      ];
    });
    setError(null);
  }, []);

  const choose = useCallback(
    (product: Product) => {
      const only = product.variants.length === 1 ? product.variants[0] : undefined;
      if (only) addVariant(product, only);
      else setPicker(product);
    },
    [addVariant]
  );

  function setQuantity(variantId: string, quantity: number) {
    setCart((current) =>
      quantity < 1
        ? current.filter((line) => line.variantId !== variantId)
        : current.map((line) => (line.variantId === variantId ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY) } : line))
    );
  }

  function reset() {
    setCart([]);
    setPayments([]);
    setManualChange(null);
    setEntry(null);
    setError(null);
  }

  /* ---------- cobrar ---------- */

  function addMoney(amount: number, note: string) {
    if (!entry) return;
    const draft: MoneyDraft = { key: nextKey++, method: entry.method, amount, note };
    if (entry.mode === "pago") {
      setPayments((current) => [...current, draft]);
      // Con otro pago, el vuelto vuelve a calcularse solo.
      setManualChange(null);
    } else {
      setManualChange([...result.change.filter((c) => c.key !== 0), draft]);
    }
    setEntry(null);
    setError(null);
  }

  function removePayment(key: number) {
    setPayments((current) => current.filter((p) => p.key !== key));
    setManualChange(null);
    focusNext();
  }

  function removeChange(key: number) {
    setManualChange(result.change.filter((c) => c.key !== key).map((c) => ({ ...c })));
    focusNext();
  }

  // Un doble clic en Cobrar no debe registrar la venta dos veces.
  const once = useOnce();
  async function charge() {
    if (!canCharge) return;
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        const registered = await ventas.create({
          lines: cart.map((line) => ({ variantId: line.variantId, quantity: line.quantity })),
          payments: result.payments.map((p) => ({ methodId: p.method.id, amount: p.amount, note: p.note })),
          change: result.change.map((c) => ({ methodId: c.method.id, amount: c.amount })),
          expectedTotal: total,
        });
        reset();
        setSale(registered);
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    });
  }

  /* ---------- teclado ---------- */

  const shortcuts = useRef({ charge, canCharge });
  shortcuts.current = { charge, canCharge };
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      // Con una ventana modal abierta, las teclas son suyas.
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "F2") {
        event.preventDefault();
        searchInput.current?.focus();
      } else if (event.key === "F4") {
        event.preventDefault();
        firstMethod.current?.focus();
      } else if (event.key === "F9") {
        event.preventDefault();
        if (shortcuts.current.canCharge) void shortcuts.current.charge();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lo que se propone al elegir un medio: justo lo que falta (o el vuelto pendiente) en su moneda.
  const pending = entry?.mode === "pago" ? result.dueValue : result.changeDue > 0 ? result.changeValue : 0n;
  const suggested = entry === null ? 0 : amountIn(pending, entry.method.currency, table);
  const others = otherCurrencies(currency, table);
  const inOthers = (value: bigint): string =>
    others.map((code) => formatMoney(amountIn(value, code, table), code)).join(" · ");
  const hasChange = result.change.length > 0 || result.changeDue !== 0;

  return (
    <div className="pos">
      <h1 className="sr-only">{t("title")}</h1>

      <section className="pos-main" aria-label={t("cart.col.product")}>
        <div className="pos-top">
          <ProductSearch inputRef={searchInput} onChoose={choose} onAdd={addVariant} />
          <button type="button" className="btn" onClick={() => setShowSales(true)}>
            <History size={20} strokeWidth={1.75} aria-hidden="true" />
            {t("sessionSales")}
          </button>
        </div>

        {cart.length === 0 ? (
          <div className="card">
            <Empty
              title={t("cart.empty.title")}
              action={
                <button type="button" className="link" onClick={() => goTo("productos")}>
                  {t("cart.empty.products")}
                </button>
              }
            >
              {t("cart.empty.body")}
            </Empty>
          </div>
        ) : (
          <>
            <div className="table-wrap">
              <table className="table cart">
                <thead>
                  <tr>
                    <th>{t("cart.col.product")}</th>
                    <th>{t("cart.col.qty")}</th>
                    <th className="right">{t("cart.col.price")}</th>
                    <th className="right">{t("cart.col.total")}</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {cart.map((line) => (
                    <tr key={line.variantId}>
                      <td>
                        <span className="cart-name">{line.description}</span>
                        {line.quantity > line.stock && (
                          <span className="badge badge--warn">
                            {line.stock > 0 ? t("cart.over", { count: line.stock }) : t("cart.none")}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="stepper">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("cart.less", { item: line.description })}
                            onClick={() => setQuantity(line.variantId, line.quantity - 1)}
                          >
                            <Minus size={18} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <span className="stepper-value num" aria-live="polite">
                            {line.quantity}
                          </span>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("cart.more", { item: line.description })}
                            onClick={() => setQuantity(line.variantId, line.quantity + 1)}
                          >
                            <Plus size={18} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </span>
                      </td>
                      <td className="right num">{formatMoney(line.unitPrice, currency)}</td>
                      <td className="right num cart-total">{formatMoney(line.unitPrice * line.quantity, currency)}</td>
                      <td className="cart-remove">
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          aria-label={t("cart.remove", { item: line.description })}
                          onClick={() => setQuantity(line.variantId, 0)}
                        >
                          <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div>
              <button type="button" className="btn btn--quiet" onClick={reset}>
                {t("cart.clear")}
              </button>
            </div>
          </>
        )}
      </section>

      <aside className="pos-pay card" aria-label={t("charge")}>
        <div className="pos-total">
          <span className="pos-total-label">{t("total")}</span>
          <span className="pos-total-value num" data-testid="total">
            {formatMoney(total, currency)}
          </span>
          <span className="muted num" data-testid="total-equivalents">
            {equivalents(total, currency, table)}
          </span>
        </div>

        {payments.length > 0 && (
          <ul className="pos-lines" aria-label={t("pay.paid")}>
            {result.payments.map((payment) => (
              <li key={payment.key}>
                <span className="pos-line-text">
                  <span>{payment.method.name}</span>
                  {payment.note && <span className="muted">{t("receipt.ref", { note: payment.note })}</span>}
                </span>
                <span className="num">{formatMoney(payment.amount, payment.method.currency)}</span>
                <button
                  type="button"
                  className="icon-btn icon-btn--danger"
                  aria-label={t("pay.remove", { method: payment.method.name })}
                  onClick={() => removePayment(payment.key)}
                >
                  <X size={18} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {cart.length > 0 && result.due > 0 && (
          <div className="pos-due" role="status">
            <span className="pos-due-label">{payments.length > 0 ? t("pay.due") : t("pay.title")}</span>
            {payments.length > 0 && (
              <>
                <span className="pos-due-value num" data-testid="due">
                  {formatMoney(result.due, currency)}
                </span>
                <span className="muted num" data-testid="due-equivalents">
                  {inOthers(result.dueValue)}
                </span>
              </>
            )}
          </div>
        )}

        {hasChange && (
          <div className="pos-change" role="status">
            <span className="pos-due-label">{t("change.title")}</span>
            <ul className="pos-lines">
              {result.change.map((line) => (
                <li key={line.key}>
                  <span className="pos-line-text">{line.method.name}</span>
                  <span className="num pos-change-value" data-testid="change">
                    {formatMoney(line.amount, line.method.currency)}
                  </span>
                  <button
                    type="button"
                    className="icon-btn icon-btn--danger"
                    aria-label={t("change.remove", { method: line.method.name })}
                    onClick={() => removeChange(line.key)}
                  >
                    <X size={18} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
            {result.changeDue > 0 && (
              <p className="num">
                {t("change.pending")}: <strong>{formatMoney(result.changeDue, currency)}</strong>{" "}
                <span className="muted">{inOthers(result.changeValue)}</span>
              </p>
            )}
            {result.changeDue < 0 && (
              <p className="field-error">{t("change.over", { amount: formatMoney(-result.changeDue, currency) })}</p>
            )}
          </div>
        )}

        {entry ? (
          <MoneyEntry
            key={`${entry.mode}-${entry.method.id}`}
            method={entry.method}
            mode={entry.mode}
            suggested={suggested}
            onAdd={addMoney}
            onCancel={() => setEntry(null)}
          />
        ) : (
          <>
            {cart.length > 0 && result.due > 0 && (
              <div className="pos-methods">
                {methods.map((method, index) => (
                  <button
                    key={method.id}
                    ref={index === 0 ? firstMethod : undefined}
                    type="button"
                    className="btn pos-method"
                    onClick={() => setEntry({ method, mode: "pago" })}
                  >
                    {method.name}
                  </button>
                ))}
              </div>
            )}
            {result.due === 0 && result.changeDue > 0 && (
              <div className="pos-give">
                <span className="pos-due-label">{t("change.give")}</span>
                <div className="pos-methods">
                  {methods.map((method, index) => (
                    <button
                      key={method.id}
                      ref={index === 0 ? firstMethod : undefined}
                      type="button"
                      className="btn pos-method"
                      onClick={() => setEntry({ method, mode: "vuelto" })}
                    >
                      {method.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        <ErrorNote>{error}</ErrorNote>

        <button ref={chargeButton} type="button" className="btn btn--primary btn--lg btn--block" disabled={!canCharge} onClick={() => void charge()}>
          {cart.length > 0 ? t("charge.total", { total: formatMoney(total, currency) }) : t("charge")}
        </button>
        <p className="pos-shortcuts muted">
          <span className="kbd">F2</span> <span className="kbd">F4</span> <span className="kbd">F9</span> {t("shortcuts")}
        </p>
      </aside>

      {picker && (
        <VariantPicker
          product={picker}
          currency={currency}
          onPick={(variant) => {
            addVariant(picker, variant);
            setPicker(null);
          }}
          onClose={() => setPicker(null)}
        />
      )}
      {showSales && <SessionSales sessionId={sessionId} onClose={() => setShowSales(false)} />}
      {sale && (
        <SaleDialog
          sale={sale}
          fresh
          onClose={() => {
            setSale(null);
            // Lista para la siguiente venta.
            window.setTimeout(() => searchInput.current?.focus(), 0);
          }}
        />
      )}
    </div>
  );
}

/* ---------- buscador ---------- */

interface ProductSearchProps {
  inputRef: RefObject<HTMLInputElement | null>;
  onChoose(product: Product): void;
  onAdd(product: Product, variant: Variant): void;
}

function ProductSearch({ inputRef, onChoose, onAdd }: ProductSearchProps) {
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
          {results.length === 0 && <li className="pos-results-none">{t("search.none", { query: query.trim() })}</li>}
          {results.map((product, index) => {
            const stock = product.variants.reduce((sum, v) => sum + v.stock, 0);
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
                <span className={stock > 0 ? "muted" : "pos-result-out"}>
                  {stock > 0 ? t("search.stock", { count: stock }) : t("search.nostock")}
                </span>
                <span className="num pos-result-price">{formatMoney(product.price, product.currency)}</span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------- elegir talla y color ---------- */

interface VariantPickerProps {
  product: Product;
  currency: CurrencyCode;
  onPick(variant: Variant): void;
  onClose(): void;
}

function VariantPicker({ product, currency, onPick, onClose }: VariantPickerProps) {
  // El foco empieza en la primera pieza con existencias.
  const first = product.variants.findIndex((variant) => variant.stock > 0);
  return (
    <Dialog title={`${product.name} · ${formatMoney(product.price, currency)}`} onClose={onClose}>
      <p className="muted">{t("picker.title")}</p>
      <div className="picker">
        {product.variants.map((variant, index) => (
          <button
            key={variant.id}
            type="button"
            className={`picker-option ${variant.stock > 0 ? "" : "is-out"}`}
            data-autofocus={index === Math.max(first, 0) ? "" : undefined}
            onClick={() => onPick(variant)}
          >
            <span className="picker-label">{[variant.size, variant.color].filter(Boolean).join(" · ")}</span>
            <span className="picker-stock">
              {variant.stock > 0 ? t("picker.stock", { count: variant.stock }) : t("picker.nostock")}
            </span>
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/* ---------- monto de un pago o de un vuelto ---------- */

interface MoneyEntryProps {
  method: PaymentMethod;
  mode: "pago" | "vuelto";
  /** Lo que falta, en la moneda del medio: es el monto que se propone. */
  suggested: number;
  onAdd(amount: number, note: string): void;
  onCancel(): void;
}

function MoneyEntry({ method, mode, suggested, onAdd, onCancel }: MoneyEntryProps) {
  const [amount, setAmount] = useState(suggested > 0 ? plainAmount(suggested, method.currency) : "");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const value = parseAmount(amount, method.currency);
  const invalid = value === null || value.amount <= 0;
  const withNote = mode === "pago" && method.kind === "electronico";

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    onAdd(value.amount, note);
  }

  return (
    <form
      className="pos-entry"
      onSubmit={submit}
      noValidate
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }}
    >
      <label className="field">
        <span className="field-label">{t("entry.amount", { method: method.name })}</span>
        <AmountInput
          currency={method.currency}
          value={amount}
          onChange={setAmount}
          autoFocus
          aria-invalid={touched && invalid ? true : undefined}
          data-testid="entry-amount"
        />
      </label>
      {touched && invalid && <p className="field-error">{t("entry.amount.invalid")}</p>}
      {withNote && (
        <label className="field">
          <span className="field-label">{t("entry.note")}</span>
          <input
            className="input"
            value={note}
            maxLength={PAYMENT_NOTE_MAX}
            placeholder={t("entry.note.placeholder")}
            autoComplete="off"
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      )}
      <div className="pos-entry-actions">
        <button type="button" className="btn" onClick={onCancel}>
          {t("entry.cancel")}
        </button>
        <button type="submit" className="btn btn--primary">
          {t("entry.add")}
        </button>
      </div>
    </form>
  );
}

/* ---------- ventas de esta caja ---------- */

function SessionSales({ sessionId, onClose }: { sessionId: string; onClose(): void }) {
  const sales = useData(() => ventas.ofSession(sessionId), [sessionId]);
  const [viewing, setViewing] = useState<Sale | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function view(id: string) {
    setError(null);
    try {
      setViewing(await ventas.get(id));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  if (viewing) return <SaleDialog sale={viewing} fresh={false} onClose={() => setViewing(null)} />;

  return (
    <Dialog title={t("list.title")} size="lg" onClose={onClose}>
      <ErrorNote>{sales.error ?? error}</ErrorNote>
      {sales.data && sales.data.length === 0 && <p className="muted">{t("list.empty")}</p>}
      {sales.data && sales.data.length > 0 && (
        <div className="table-wrap">
          <table className="table table--compact">
            <thead>
              <tr>
                <th>{t("list.col.number")}</th>
                <th>{t("list.col.time")}</th>
                <th className="right">{t("list.col.pieces")}</th>
                <th className="right">{t("list.col.total")}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {sales.data.map((item) => (
                <tr key={item.id}>
                  <td className="num">{item.number}</td>
                  <td>{formatTime(item.createdAt)}</td>
                  <td className="right num">{item.pieces}</td>
                  <td className="right num">{formatMoney(item.total, item.currency)}</td>
                  <td className="right">
                    <button type="button" className="link" onClick={() => void view(item.id)}>
                      {t("list.view")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Dialog>
  );
}
