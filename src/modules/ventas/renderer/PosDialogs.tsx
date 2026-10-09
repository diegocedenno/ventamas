// Las ventanas pequeñas de la pantalla de venta: elegir la pieza, escribir un precio
// abierto, el descuento de una línea o de toda la venta, la nota y las ventas en espera.

import { useState, type FormEvent } from "react";
import { parseAmount, parseDecimal, type CurrencyCode } from "@shared/money";
import { Segmented } from "../../../renderer/src/components/Choices";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { AmountInput, ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { formatMoney, formatTime, plainAmount } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { priceOf, variantLabel, type Product, type Variant } from "../../inventario/api";
import { PARK_LABEL_MAX, SALE_NOTE_MAX, type ParkedInfo, type Sale } from "../api";
import { lineDiscount, type CartLine } from "../cart";
import { PERCENT_SCALE, type SaleDiscount } from "../pricing";
import { ventas } from "./client";
import { SaleDialog } from "./SaleDialog";
import { t } from "./texts";

/* ---------- elegir la pieza ---------- */

interface VariantPickerProps {
  product: Product;
  onPick(variant: Variant): void;
  onClose(): void;
}

export function VariantPicker({ product, onPick, onClose }: VariantPickerProps) {
  const service = product.kind === "servicio";
  // El foco empieza en la primera pieza con existencias.
  const first = service ? 0 : product.variants.findIndex((variant) => variant.stock > 0);
  const ownPrices = product.variants.some((variant) => variant.price !== null);
  const title = ownPrices || product.openPrice ? product.name : `${product.name} · ${formatMoney(product.price, product.currency)}`;
  return (
    <Dialog title={title} onClose={onClose}>
      <p className="muted">{service ? t("picker.title.service") : t("picker.title")}</p>
      <div className="picker">
        {product.variants.map((variant, index) => (
          <button
            key={variant.id}
            type="button"
            className={`picker-option ${service || variant.stock > 0 ? "" : "is-out"}`}
            data-autofocus={index === Math.max(first, 0) ? "" : undefined}
            onClick={() => onPick(variant)}
          >
            <span className="picker-label">{variantLabel(variant)}</span>
            {ownPrices && !product.openPrice && <span className="picker-price num">{formatMoney(priceOf(product, variant), product.currency)}</span>}
            {!service && (
              <span className="picker-stock">{variant.stock > 0 ? t("picker.stock", { count: variant.stock }) : t("picker.nostock")}</span>
            )}
          </button>
        ))}
      </div>
    </Dialog>
  );
}

/* ---------- precio abierto ---------- */

interface OpenPriceDialogProps {
  description: string;
  currency: CurrencyCode;
  onAdd(price: number): void;
  onClose(): void;
}

/** Un producto de precio abierto pide su precio cada vez que se vende. */
export function OpenPriceDialog({ description, currency, onAdd, onClose }: OpenPriceDialogProps) {
  const [price, setPrice] = useState("");
  const [touched, setTouched] = useState(false);
  const value = parseAmount(price, currency);
  const invalid = value === null || value.amount <= 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (invalid) return;
    onAdd(value.amount);
  }

  return (
    <Dialog
      title={t("open.title", { item: description })}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="submit" form="open-price-form" className="btn btn--primary">
            {t("open.add")}
          </button>
        </>
      }
    >
      <form id="open-price-form" onSubmit={submit} noValidate>
        <Field label={t("open.label")} error={touched && invalid ? t("open.invalid") : null}>
          {(props) => <AmountInput {...props} currency={currency} value={price} onChange={setPrice} data-autofocus="" />}
        </Field>
      </form>
    </Dialog>
  );
}

/* ---------- descuentos ---------- */

type DiscountKind = SaleDiscount["kind"];

const KINDS: ReadonlyArray<{ value: DiscountKind; label: string }> = [
  { value: "percent", label: t("line.discount.percent") },
  { value: "amount", label: t("line.discount.amount") },
];

const percentText = (value: number): string => String(value / 100).replace(".", ",");

/** Lee lo escrito como descuento. undefined: no se entiende o se pasa de lo permitido. null: sin descuento. */
function readDiscount(kind: DiscountKind, text: string, currency: CurrencyCode, limit: number): SaleDiscount | null | undefined {
  if (text.trim() === "") return null;
  if (kind === "percent") {
    const value = parseDecimal(text, 2);
    if (value === null || value > PERCENT_SCALE) return undefined;
    return value === 0 ? null : { kind, value };
  }
  const value = parseAmount(text, currency);
  if (value === null || value.amount > limit) return undefined;
  return value.amount === 0 ? null : { kind, value: value.amount };
}

interface DiscountFieldsProps {
  kind: DiscountKind;
  text: string;
  currency: CurrencyCode;
  invalid: boolean;
  amountLabel: string;
  amountError: string;
  onKind(kind: DiscountKind): void;
  onText(text: string): void;
}

function DiscountFields({ kind, text, currency, invalid, amountLabel, amountError, onKind, onText }: DiscountFieldsProps) {
  return (
    <div className="discount-fields">
      <Segmented label={t("line.discount.kind")} value={kind} options={KINDS} onChange={onKind} />
      {kind === "percent" ? (
        <Field label={t("line.discount.value.percent")} error={invalid ? t("line.discount.invalid.percent") : null}>
          {(props) => (
            <span className="percent">
              <input
                {...props}
                className="input num percent-input"
                inputMode="decimal"
                autoComplete="off"
                data-autofocus=""
                value={text}
                onFocus={(event) => event.target.select()}
                onChange={(event) => onText(event.target.value)}
              />
              <span className="percent-symbol" aria-hidden="true">
                %
              </span>
            </span>
          )}
        </Field>
      ) : (
        <Field label={amountLabel} error={invalid ? amountError : null}>
          {(props) => <AmountInput {...props} currency={currency} value={text} onChange={onText} data-autofocus="" />}
        </Field>
      )}
    </div>
  );
}

interface LineDialogProps {
  line: CartLine;
  currency: CurrencyCode;
  onApply(change: { unitPrice: number; discount: SaleDiscount | null }): void;
  onClose(): void;
}

/** El descuento de una línea y, si el producto es de precio abierto, su precio. */
export function LineDialog({ line, currency, onApply, onClose }: LineDialogProps) {
  const [price, setPrice] = useState(plainAmount(line.unitPrice, currency));
  const [kind, setKind] = useState<DiscountKind>(line.discount?.kind ?? "percent");
  const [text, setText] = useState(
    line.discount ? (line.discount.kind === "percent" ? percentText(line.discount.value) : plainAmount(line.discount.value, currency)) : ""
  );
  const [touched, setTouched] = useState(false);

  const priceValue = line.openPrice ? parseAmount(price, currency) : { amount: line.unitPrice };
  const priceInvalid = priceValue === null || priceValue.amount <= 0;
  const unitPrice = priceInvalid ? line.unitPrice : priceValue.amount;
  const gross = unitPrice * line.quantity;
  const discount = readDiscount(kind, text, currency, gross);
  const left = discount === undefined ? gross : gross - lineDiscount({ unitPrice, quantity: line.quantity, discount });

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (priceInvalid || discount === undefined) return;
    onApply({ unitPrice, discount });
  }

  return (
    <Dialog
      title={t("line.title", { item: line.description })}
      onClose={onClose}
      footer={
        <>
          {line.discount && (
            <button type="button" className="btn btn--quiet spacer" onClick={() => onApply({ unitPrice: line.unitPrice, discount: null })}>
              {t("line.clear")}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="submit" form="line-form" className="btn btn--primary">
            {t("line.apply")}
          </button>
        </>
      }
    >
      <form id="line-form" className="stack" onSubmit={submit} noValidate>
        {line.openPrice && (
          <Field label={t("line.price")} error={touched && priceInvalid ? t("open.invalid") : null}>
            {(props) => <AmountInput {...props} currency={currency} value={price} onChange={setPrice} />}
          </Field>
        )}
        <h3 className="subsection-title">{t("line.discount")}</h3>
        <DiscountFields
          kind={kind}
          text={text}
          currency={currency}
          invalid={touched && discount === undefined}
          amountLabel={t("line.discount.value.amount")}
          amountError={t("line.discount.invalid.amount")}
          onKind={(next) => {
            setKind(next);
            setText("");
          }}
          onText={setText}
        />
        <p className="muted num" role="status">
          {t("line.result", { total: formatMoney(left, currency) })}
        </p>
      </form>
    </Dialog>
  );
}

interface DiscountDialogProps {
  discount: SaleDiscount | null;
  /** Lo que vale la venta después de los descuentos de línea. */
  amount: number;
  currency: CurrencyCode;
  onApply(discount: SaleDiscount | null): void;
  onClose(): void;
}

/** El descuento a toda la venta. */
export function DiscountDialog({ discount: current, amount, currency, onApply, onClose }: DiscountDialogProps) {
  const [kind, setKind] = useState<DiscountKind>(current?.kind ?? "percent");
  const [text, setText] = useState(current ? (current.kind === "percent" ? percentText(current.value) : plainAmount(current.value, currency)) : "");
  const [touched, setTouched] = useState(false);
  const discount = readDiscount(kind, text, currency, amount);
  const left =
    discount === undefined || discount === null
      ? amount
      : amount - (discount.kind === "percent" ? Math.round((amount * discount.value) / PERCENT_SCALE) : discount.value);

  function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (discount === undefined) return;
    onApply(discount);
  }

  return (
    <Dialog
      title={t("discount.title")}
      onClose={onClose}
      footer={
        <>
          {current && (
            <button type="button" className="btn btn--quiet spacer" onClick={() => onApply(null)}>
              {t("line.clear")}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="submit" form="discount-form" className="btn btn--primary">
            {t("line.apply")}
          </button>
        </>
      }
    >
      <form id="discount-form" className="stack" onSubmit={submit} noValidate>
        <p className="muted">{t("discount.hint")}</p>
        <DiscountFields
          kind={kind}
          text={text}
          currency={currency}
          invalid={touched && discount === undefined}
          amountLabel={t("discount.value.amount")}
          amountError={t("discount.invalid.amount")}
          onKind={(next) => {
            setKind(next);
            setText("");
          }}
          onText={setText}
        />
        <p className="muted num" role="status">
          {t("discount.result", { total: formatMoney(left, currency) })}
        </p>
      </form>
    </Dialog>
  );
}

/* ---------- nota ---------- */

export function NoteDialog({ note: current, onApply, onClose }: { note: string; onApply(note: string): void; onClose(): void }) {
  const [note, setNote] = useState(current);
  return (
    <Dialog
      title={t("note.title")}
      onClose={onClose}
      footer={
        <>
          {current && (
            <button type="button" className="btn btn--quiet spacer" onClick={() => onApply("")}>
              {t("note.remove")}
            </button>
          )}
          <button type="button" className="btn" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="submit" form="note-form" className="btn btn--primary">
            {t("note.save")}
          </button>
        </>
      }
    >
      <form
        id="note-form"
        onSubmit={(event) => {
          event.preventDefault();
          onApply(note);
        }}
      >
        <Field label={t("note.label")}>
          {(props) => (
            <textarea
              {...props}
              className="input"
              value={note}
              maxLength={SALE_NOTE_MAX}
              placeholder={t("note.placeholder")}
              data-autofocus=""
              onChange={(event) => setNote(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

/* ---------- confirmar ---------- */

interface ConfirmDialogProps {
  title: string;
  body: string;
  confirm: string;
  onConfirm(): void;
  onClose(): void;
}

/** Confirmación de algo que no se puede deshacer. El foco empieza en Cancelar. */
export function ConfirmDialog({ title, body, confirm, onConfirm, onClose }: ConfirmDialogProps) {
  return (
    <Dialog
      title={title}
      size="sm"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" data-autofocus="" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="button" className="btn btn--danger" onClick={onConfirm}>
            {confirm}
          </button>
        </>
      }
    >
      <p>{body}</p>
    </Dialog>
  );
}

/* ---------- ventas en espera ---------- */

export function ParkDialog({ onPark, onClose }: { onPark(label: string): void; onClose(): void }) {
  const [label, setLabel] = useState("");
  return (
    <Dialog
      title={t("park.title")}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("entry.cancel")}
          </button>
          <button type="submit" form="park-form" className="btn btn--primary">
            {t("park.confirm")}
          </button>
        </>
      }
    >
      <form
        id="park-form"
        className="stack"
        onSubmit={(event) => {
          event.preventDefault();
          onPark(label);
        }}
      >
        <p className="muted">{t("park.body")}</p>
        <Field label={t("park.label")}>
          {(props) => (
            <input
              {...props}
              className="input"
              value={label}
              maxLength={PARK_LABEL_MAX}
              placeholder={t("park.label.placeholder")}
              autoComplete="off"
              data-autofocus=""
              onChange={(event) => setLabel(event.target.value)}
            />
          )}
        </Field>
      </form>
    </Dialog>
  );
}

interface ParkedDialogProps {
  parked: readonly ParkedInfo[];
  /** Hay una venta a medio armar: primero hay que terminarla o dejarla en espera. */
  busy: boolean;
  onTake(id: string): void;
  onDiscard(id: string): void;
  onClose(): void;
}

export function ParkedDialog({ parked, busy, onTake, onDiscard, onClose }: ParkedDialogProps) {
  return (
    <Dialog title={t("parked.title")} onClose={onClose}>
      {busy && <p className="note note--info">{t("parked.busy")}</p>}
      {parked.length === 0 && <p className="muted">{t("parked.empty")}</p>}
      <ul className="parked">
        {parked.map((item) => {
          const name = item.label || t("parked.unnamed");
          return (
            <li key={item.id} className="parked-item">
              <span className="parked-text">
                <span className="parked-name">{name}</span>
                <span className="muted num">
                  {formatTime(item.createdAt)} · {item.pieces === 1 ? t("parked.pieces.one") : t("parked.pieces", { count: item.pieces })}
                </span>
              </span>
              <button type="button" className="btn btn--quiet" aria-label={t("parked.discard.label", { name })} onClick={() => onDiscard(item.id)}>
                {t("parked.discard")}
              </button>
              <button
                type="button"
                className="btn btn--primary"
                disabled={busy}
                aria-label={t("parked.take.label", { name })}
                onClick={() => onTake(item.id)}
              >
                {t("parked.take")}
              </button>
            </li>
          );
        })}
      </ul>
    </Dialog>
  );
}

/* ---------- ventas de esta caja ---------- */

export function SessionSales({ sessionId, onClose }: { sessionId: string; onClose(): void }) {
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
                <th>{t("list.col.customer")}</th>
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
                  <td>{item.customerName}</td>
                  <td className="right num">{item.pieces}</td>
                  <td className="right num">{formatMoney(item.total, item.currency)}</td>
                  <td className="right">
                    <button type="button" className="link" aria-label={t("list.view.label", { number: item.number })} onClick={() => void view(item.id)}>
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
