import { History, Minus, PauseCircle, Percent, Plus, StickyNote, Trash2, UserRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { money, type CurrencyCode, type RateTable } from "@shared/money";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { formatMoney } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import type { PaymentMethod } from "../../caja/api";
import type { Customer } from "../../clientes/api";
import { clientes } from "../../clientes/renderer/client";
import { CustomerPicker } from "../../clientes/renderer/CustomerPicker";
import { DEFAULT_TAX_CLASS, formatTaxRate, type TaxClass } from "../../impuestos/api";
import { impuestos } from "../../impuestos/renderer/client";
import { describeVariant, priceOf, type Product, type Variant } from "../../inventario/api";
import { MAX_QUANTITY, type Sale } from "../api";
import { lineDiscount, priceCart, proposeChange, toSaleLines, usableDiscount, type CartLine } from "../cart";
import type { SaleDiscount } from "../pricing";
import { amountIn, settle } from "../settlement";
import { Browse } from "./Browse";
import { ventas } from "./client";
import { MoneyEntry } from "./MoneyEntry";
import {
  ConfirmDialog,
  DiscountDialog,
  LineDialog,
  NoteDialog,
  OpenPriceDialog,
  ParkDialog,
  ParkedDialog,
  SessionSales,
  VariantPicker,
} from "./PosDialogs";
import { ProductSearch } from "./ProductSearch";
import { equivalents, otherCurrencies } from "./Receipt";
import { SaleDialog } from "./SaleDialog";
import { t } from "./texts";

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

type Open =
  | { type: "picker"; product: Product }
  | { type: "price"; product: Product; variant: Variant }
  | { type: "line"; key: number }
  | { type: "discount" }
  | { type: "customer" }
  | { type: "note" }
  | { type: "park" }
  | { type: "parked" }
  | { type: "sales" }
  | { type: "clear" }
  | null;

let nextKey = 1;
const percent = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 2 });
const UNDO_MS = 8000;

/** Toda la venta en una pantalla: buscar, armar la venta, cobrar en varias monedas y dar el vuelto. */
export function Pos({ currency, table, methods, sessionId }: PosProps) {
  const { settings } = useApp();
  const taxEnabled = settings["tax.enabled"];
  const taxIncluded = settings["tax.included"];

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discount, setDiscount] = useState<SaleDiscount | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [note, setNote] = useState("");
  const [payments, setPayments] = useState<MoneyDraft[]>([]);
  // null: el vuelto se propone solo. Una lista: quien cobra lo repartió a mano.
  const [manualChange, setManualChange] = useState<MoneyDraft[] | null>(null);
  const [entry, setEntry] = useState<{ method: PaymentMethod; mode: "pago" | "vuelto" } | null>(null);
  const [open, setOpen] = useState<Open>(null);
  const [sale, setSale] = useState<Sale | null>(null);
  const [removed, setRemoved] = useState<{ line: CartLine; index: number } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parked = useData(() => ventas.parked(), []);
  const taxes = useData<TaxClass[]>(() => (taxEnabled ? impuestos.list() : Promise.resolve([])), [taxEnabled]);

  const searchInput = useRef<HTMLInputElement>(null);
  const firstMethod = useRef<HTMLButtonElement>(null);
  const chargeButton = useRef<HTMLButtonElement>(null);

  /* ---------- la cuenta ---------- */

  const taxOf = useCallback(
    (taxClass: string) => {
      if (!taxEnabled) return null;
      const list = taxes.data ?? [];
      const found = list.find((tax) => tax.id === taxClass) ?? list.find((tax) => tax.id === DEFAULT_TAX_CLASS);
      return found ? { id: found.id, rate: found.rate } : null;
    },
    [taxEnabled, taxes.data]
  );

  const pricing = useMemo(() => priceCart(cart, discount, taxOf, taxIncluded), [cart, discount, taxOf, taxIncluded]);
  const total = pricing.total;

  const result = useMemo(() => {
    const paid = payments.map((p) => ({ ...p, currency: p.method.currency }));
    const before = settle(money(total, currency), paid, [], table);

    let change = manualChange;
    if (change === null) {
      change = proposeChange(before.changeValue, payments.at(-1)?.method, methods, currency, table).map((part, index) => ({
        // Las claves que no son positivas marcan el vuelto propuesto, no escrito a mano.
        key: -index,
        method: part.method,
        amount: part.amount,
        note: "",
      }));
    }
    return settle(
      money(total, currency),
      paid,
      change.map((c) => ({ ...c, currency: c.method.currency })),
      table
    );
  }, [total, currency, table, payments, manualChange, methods]);

  // Los impuestos tardan un instante en llegar: hasta entonces no se cobra con una cuenta incompleta.
  const ready = !taxEnabled || taxes.data !== undefined;
  const canCharge = cart.length > 0 && result.settled && !busy && ready;

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

  // Lo quitado se puede deshacer durante unos segundos.
  useEffect(() => {
    if (!removed) return;
    const timer = window.setTimeout(() => setRemoved(null), UNDO_MS);
    return () => window.clearTimeout(timer);
  }, [removed]);

  /* ---------- armar la venta ---------- */

  const addVariant = useCallback((product: Product, variant: Variant, price?: number) => {
    const description = describeVariant(product.name, variant);
    setCart((current) => {
      // Un producto de precio abierto es una línea nueva cada vez: su precio puede cambiar.
      const existing = product.openPrice ? undefined : current.find((line) => line.variantId === variant.id);
      if (existing) {
        return current.map((line) => (line === existing ? { ...line, quantity: Math.min(line.quantity + 1, MAX_QUANTITY) } : line));
      }
      return [
        ...current,
        {
          key: nextKey++,
          variantId: variant.id,
          description,
          kind: product.kind,
          unitPrice: price ?? priceOf(product, variant),
          openPrice: product.openPrice,
          taxClass: product.taxClass,
          quantity: 1,
          stock: variant.stock,
          discount: null,
        },
      ];
    });
    setError(null);
    setNotice(null);
    setRemoved(null);
  }, []);

  /** Una pieza ya elegida: va a la venta, salvo que antes haya que escribir su precio. */
  const take = useCallback(
    (product: Product, variant: Variant) => {
      if (product.openPrice) setOpen({ type: "price", product, variant });
      else {
        addVariant(product, variant);
        setOpen(null);
      }
    },
    [addVariant]
  );

  const choose = useCallback(
    (product: Product) => {
      const only = product.variants.length === 1 ? product.variants[0] : undefined;
      if (only) take(product, only);
      else setOpen({ type: "picker", product });
    },
    [take]
  );

  function setQuantity(key: number, quantity: number) {
    if (quantity < 1) {
      const index = cart.findIndex((line) => line.key === key);
      const line = cart[index];
      if (line) setRemoved({ line, index });
      setCart((current) => current.filter((item) => item.key !== key));
      return;
    }
    setCart((current) => current.map((line) => (line.key === key ? { ...line, quantity: Math.min(quantity, MAX_QUANTITY) } : line)));
  }

  function undoRemove() {
    if (!removed) return;
    setCart((current) => [...current.slice(0, removed.index), removed.line, ...current.slice(removed.index)]);
    setRemoved(null);
  }

  function reset() {
    setCart([]);
    setDiscount(null);
    setCustomer(null);
    setNote("");
    setPayments([]);
    setManualChange(null);
    setEntry(null);
    setRemoved(null);
    setError(null);
  }

  /* ---------- ventas en espera ---------- */

  async function park(label: string) {
    setOpen(null);
    setError(null);
    try {
      parked.set(
        await ventas.park({ label, lines: toSaleLines(cart), discount: usableDiscount(cart, discount), customerId: customer?.id ?? null, note })
      );
      reset();
      searchInput.current?.focus();
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  async function takeParked(id: string) {
    setOpen(null);
    setError(null);
    try {
      const resumed = await ventas.takeParked(id);
      const who = resumed.customerId ? await clientes.get(resumed.customerId).catch(() => null) : null;
      setCart(
        resumed.lines.map((line) => ({
          key: nextKey++,
          variantId: line.variantId,
          description: line.description,
          kind: line.kind,
          unitPrice: line.unitPrice,
          openPrice: line.openPrice,
          taxClass: line.taxClass,
          quantity: line.quantity,
          stock: line.stock,
          discount: line.discount > 0 ? { kind: "amount", value: line.discount } : null,
        }))
      );
      setDiscount(resumed.discount);
      setCustomer(who);
      setNote(resumed.note);
      setPayments([]);
      setManualChange(null);
      setNotice(resumed.dropped === 0 ? null : resumed.dropped === 1 ? t("parked.dropped.one") : t("parked.dropped", { count: resumed.dropped }));
    } catch (reason) {
      setError(messageOf(reason));
    }
    void parked.reload();
  }

  async function discardParked(id: string) {
    try {
      parked.set(await ventas.discardParked(id));
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  /* ---------- cobrar ---------- */

  function addMoney(amount: number, moneyNote: string) {
    if (!entry) return;
    const draft: MoneyDraft = { key: nextKey++, method: entry.method, amount, note: moneyNote };
    if (entry.mode === "pago") {
      setPayments((current) => [...current, draft]);
      // Con otro pago, el vuelto vuelve a calcularse solo.
      setManualChange(null);
    } else {
      // El vuelto escrito a mano sustituye al propuesto.
      setManualChange([...result.change.filter((c) => c.key > 0), draft]);
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
    // Lo que queda del vuelto propuesto pasa a ser vuelto escrito a mano, con clave propia.
    setManualChange(result.change.filter((c) => c.key !== key).map((c) => ({ ...c, key: c.key > 0 ? c.key : nextKey++ })));
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
          lines: toSaleLines(cart),
          discount: usableDiscount(cart, discount),
          customerId: customer?.id ?? null,
          note,
          payments: result.payments.map((p) => ({ methodId: p.method.id, amount: p.amount, note: p.note })),
          change: result.change.map((c) => ({ methodId: c.method.id, amount: c.amount })),
          expectedTotal: total,
        });
        reset();
        setRefresh((value) => value + 1);
        setSale(registered);
      } catch (reason) {
        setError(messageOf(reason));
      } finally {
        setBusy(false);
      }
    });
  }

  /* ---------- teclado ---------- */

  const shortcuts = useRef({ charge, canCharge, hasCart: cart.length > 0, hasParked: (parked.data?.length ?? 0) > 0 });
  shortcuts.current = { charge, canCharge, hasCart: cart.length > 0, hasParked: (parked.data?.length ?? 0) > 0 };
  useEffect(() => {
    function onKey(event: globalThis.KeyboardEvent) {
      // Con una ventana modal abierta, las teclas son suyas.
      if (document.querySelector("dialog[open]")) return;
      const state = shortcuts.current;
      const run = (action: () => void) => {
        event.preventDefault();
        action();
      };
      if (event.key === "F2") run(() => searchInput.current?.focus());
      else if (event.key === "F4") run(() => firstMethod.current?.focus());
      else if (event.key === "F6") run(() => setOpen({ type: "customer" }));
      else if (event.key === "F7") run(() => state.hasCart && setOpen({ type: "discount" }));
      else if (event.key === "F8") run(() => (state.hasCart ? setOpen({ type: "park" }) : state.hasParked && setOpen({ type: "parked" })));
      else if (event.key === "F9") run(() => state.canCharge && void state.charge());
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Lo que se propone al elegir un medio: justo lo que falta (o el vuelto pendiente) en su moneda.
  const pending = entry?.mode === "pago" ? result.dueValue : result.changeDue > 0 ? result.changeValue : 0n;
  const suggested = entry === null ? 0 : amountIn(pending, entry.method.currency, table);
  const others = otherCurrencies(currency, table);
  const inOthers = (value: bigint): string => others.map((code) => formatMoney(amountIn(value, code, table), code)).join(" · ");
  const hasChange = result.change.length > 0 || result.changeDue !== 0;
  const editing = open?.type === "line" ? cart.find((line) => line.key === open.key) : undefined;
  const parkedCount = parked.data?.length ?? 0;
  const general = usableDiscount(cart, discount);
  const taxName = (id: string) => (taxes.data ?? []).find((tax) => tax.id === id)?.name ?? "";
  const closeDialog = () => setOpen(null);

  return (
    <div className="pos">
      <h1 className="sr-only">{t("title")}</h1>

      <section className="pos-main" aria-label={t("cart.col.product")}>
        <div className="pos-top">
          <ProductSearch inputRef={searchInput} onChoose={choose} onAdd={take} />
          <div className="pos-top-actions">
            {parkedCount > 0 && (
              <button type="button" className="btn" onClick={() => setOpen({ type: "parked" })}>
                <PauseCircle size={20} strokeWidth={1.75} aria-hidden="true" />
                {t("parked", { count: parkedCount })}
              </button>
            )}
            <button type="button" className="btn" onClick={() => setOpen({ type: "sales" })}>
              <History size={20} strokeWidth={1.75} aria-hidden="true" />
              {t("sessionSales")}
            </button>
          </div>
        </div>

        {notice && (
          <p className="note note--info" role="status">
            {notice}
          </p>
        )}

        {cart.length > 0 && (
          <div className="table-wrap">
            <table className="table cart">
              <thead>
                <tr>
                  <th>{t("cart.col.product")}</th>
                  <th>{t("cart.col.qty")}</th>
                  <th className="right">{t("cart.col.total")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {cart.map((line) => {
                  const gross = line.unitPrice * line.quantity;
                  const off = lineDiscount(line);
                  return (
                    <tr key={line.key}>
                      <td>
                        <span className="cart-name">{line.description}</span>
                        <span className="cart-tags">
                          <span className="cart-unit muted num">{t("cart.each", { price: formatMoney(line.unitPrice, currency) })}</span>
                          {line.kind === "producto" && line.quantity > line.stock && (
                            <span className="badge badge--warn">{line.stock > 0 ? t("cart.over", { count: line.stock }) : t("cart.none")}</span>
                          )}
                          {off > 0 && <span className="badge badge--accent num">{t("cart.discount", { amount: formatMoney(off, currency) })}</span>}
                        </span>
                      </td>
                      <td>
                        <span className="stepper">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("cart.less", { item: line.description })}
                            onClick={() => setQuantity(line.key, line.quantity - 1)}
                          >
                            <Minus size={18} strokeWidth={2} aria-hidden="true" />
                          </button>
                          <input
                            className="stepper-value num"
                            aria-label={t("cart.qty", { item: line.description })}
                            inputMode="numeric"
                            autoComplete="off"
                            value={line.quantity}
                            onFocus={(event) => event.target.select()}
                            onChange={(event) => {
                              const typed = Number(event.target.value.replace(/\D/g, ""));
                              // Borrar el número no quita la línea: para eso está la papelera.
                              if (typed >= 1) setQuantity(line.key, typed);
                            }}
                          />
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={t("cart.more", { item: line.description })}
                            onClick={() => setQuantity(line.key, line.quantity + 1)}
                          >
                            <Plus size={18} strokeWidth={2} aria-hidden="true" />
                          </button>
                        </span>
                      </td>
                      <td className="right num cart-total">
                        {off > 0 && <s className="cart-before">{formatMoney(gross, currency)}</s>}
                        {formatMoney(gross - off, currency)}
                      </td>
                      <td className="cart-actions">
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={t("cart.edit", { item: line.description })}
                          title={t("line.discount")}
                          onClick={() => setOpen({ type: "line", key: line.key })}
                        >
                          <Percent size={18} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="icon-btn icon-btn--danger"
                          aria-label={t("cart.remove", { item: line.description })}
                          onClick={() => setQuantity(line.key, 0)}
                        >
                          <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {(cart.length > 0 || removed) && (
          <div className="pos-cart-actions">
            {cart.length > 0 && (
              <>
                <button type="button" className="btn" onClick={() => setOpen({ type: "park" })}>
                  <PauseCircle size={20} strokeWidth={1.75} aria-hidden="true" />
                  {t("park")}
                </button>
                <button type="button" className="btn btn--quiet" onClick={() => (cart.length > 1 ? setOpen({ type: "clear" }) : reset())}>
                  {t("cart.clear")}
                </button>
              </>
            )}
            {removed && (
              <p className="pos-undo" role="status">
                {t("cart.removed", { item: removed.line.description })}{" "}
                <button type="button" className="link" onClick={undoRemove}>
                  {t("cart.undo")}
                </button>
              </p>
            )}
          </div>
        )}

        <Browse onChoose={choose} refresh={refresh} />
      </section>

      <aside className="pos-pay card" aria-label={t("charge")}>
        <div className="pos-customer">
          {customer ? (
            <>
              <button type="button" className="pos-customer-name" aria-label={t("customer.change", { name: customer.name })} onClick={() => setOpen({ type: "customer" })}>
                <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
                <span>
                  <span className="pos-customer-text">{customer.name}</span>
                  {customer.doc && <span className="muted num">{customer.doc}</span>}
                </span>
              </button>
              <button type="button" className="icon-btn icon-btn--danger" aria-label={t("customer.remove")} onClick={() => setCustomer(null)}>
                <X size={18} strokeWidth={1.75} aria-hidden="true" />
              </button>
            </>
          ) : (
            <button type="button" className="btn btn--quiet pos-customer-add" onClick={() => setOpen({ type: "customer" })}>
              <UserRound size={20} strokeWidth={1.75} aria-hidden="true" />
              {t("customer.add")}
            </button>
          )}
        </div>

        <div className="pos-sums">
          {(pricing.lineDiscounts > 0 || pricing.discount > 0 || (pricing.tax > 0 && !taxIncluded)) && (
            <p className="pos-sum">
              <span>{t("subtotal")}</span>
              <span className="num">{formatMoney(pricing.subtotal, currency)}</span>
            </p>
          )}
          {pricing.lineDiscounts > 0 && (
            <p className="pos-sum">
              <span>{t("discount.lines")}</span>
              <span className="num">{formatMoney(-pricing.lineDiscounts, currency)}</span>
            </p>
          )}
          {general && (
            <p className="pos-sum">
              <button type="button" className="link" onClick={() => setOpen({ type: "discount" })}>
                {general.kind === "percent" ? t("discount.percent", { percent: percent.format(general.value / 100) }) : t("discount")}
              </button>
              <span className="num" data-testid="discount">
                {formatMoney(-pricing.discount, currency)}
              </span>
            </p>
          )}
          {pricing.taxes
            .filter((tax) => tax.tax > 0)
            .map((tax) => (
              <p className="pos-sum" key={tax.id}>
                <span>
                  {t("tax.amount", { name: taxName(tax.id), rate: formatTaxRate(tax.rate) })}
                  {taxIncluded && <span className="muted"> · {t("tax.included")}</span>}
                </span>
                <span className="num" data-testid="tax">
                  {formatMoney(tax.tax, currency)}
                </span>
              </p>
            ))}
        </div>

        <div className="pos-total">
          <span className="pos-total-label">{t("total")}</span>
          <span className="pos-total-value num" data-testid="total">
            {formatMoney(total, currency)}
          </span>
          <span className="muted num" data-testid="total-equivalents">
            {equivalents(total, currency, table)}
          </span>
        </div>

        {cart.length > 0 && (
          <div className="pos-extras">
            {!general && (
              <button type="button" className="btn btn--quiet" onClick={() => setOpen({ type: "discount" })}>
                <Percent size={18} strokeWidth={1.75} aria-hidden="true" />
                {t("discount.add")}
              </button>
            )}
            <button type="button" className="btn btn--quiet" onClick={() => setOpen({ type: "note" })}>
              <StickyNote size={18} strokeWidth={1.75} aria-hidden="true" />
              {note ? t("note") : t("note.add")}
            </button>
          </div>
        )}
        {note && <p className="pos-note muted">{note}</p>}

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
            {result.changeDue < 0 && <p className="field-error">{t("change.over", { amount: formatMoney(-result.changeDue, currency) })}</p>}
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

        <ErrorNote>{error ?? taxes.error ?? parked.error}</ErrorNote>

        <button ref={chargeButton} type="button" className="btn btn--primary btn--lg btn--block" disabled={!canCharge} onClick={() => void charge()}>
          {cart.length > 0 ? t("charge.total", { total: formatMoney(total, currency) }) : t("charge")}
        </button>
        <ul className="pos-shortcuts muted" aria-hidden="true">
          {(
            [
              ["F2", "shortcut.search"],
              ["F4", "shortcut.pay"],
              ["F6", "shortcut.customer"],
              ["F7", "shortcut.discount"],
              ["F8", "shortcut.park"],
              ["F9", "shortcut.charge"],
            ] as const
          ).map(([key, label]) => (
            <li key={key}>
              <span className="kbd">{key}</span> {t(label)}
            </li>
          ))}
        </ul>
      </aside>

      {open?.type === "picker" && <VariantPicker product={open.product} onPick={(variant) => take(open.product, variant)} onClose={closeDialog} />}
      {open?.type === "price" && (
        <OpenPriceDialog
          description={describeVariant(open.product.name, open.variant)}
          currency={currency}
          onAdd={(price) => {
            addVariant(open.product, open.variant, price);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {editing && (
        <LineDialog
          line={editing}
          currency={currency}
          onApply={(change) => {
            setCart((current) => current.map((line) => (line.key === editing.key ? { ...line, ...change } : line)));
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {open?.type === "discount" && (
        <DiscountDialog
          discount={general}
          amount={pricing.subtotal - pricing.lineDiscounts}
          currency={currency}
          onApply={(next) => {
            setDiscount(next);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {open?.type === "customer" && (
        <CustomerPicker
          current={customer}
          onPick={(next) => {
            setCustomer(next);
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {open?.type === "note" && (
        <NoteDialog
          note={note}
          onApply={(next) => {
            setNote(next.trim());
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {open?.type === "park" && <ParkDialog onPark={(label) => void park(label)} onClose={closeDialog} />}
      {open?.type === "parked" && (
        <ParkedDialog
          parked={parked.data ?? []}
          busy={cart.length > 0}
          onTake={(id) => void takeParked(id)}
          onDiscard={(id) => void discardParked(id)}
          onClose={closeDialog}
        />
      )}
      {open?.type === "clear" && (
        <ConfirmDialog
          title={t("cart.clear.title")}
          body={t("cart.clear.body", { count: cart.length })}
          confirm={t("cart.clear.confirm")}
          onConfirm={() => {
            reset();
            closeDialog();
          }}
          onClose={closeDialog}
        />
      )}
      {open?.type === "sales" && <SessionSales sessionId={sessionId} onClose={closeDialog} />}
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
