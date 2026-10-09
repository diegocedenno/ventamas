import { useState, type FormEvent } from "react";
import { parseAmount } from "@shared/money";
import { Segmented } from "../../../renderer/src/components/Choices";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { AmountInput, ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { formatDateTime } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { STOCK_NOTE_MAX, variantLabel, type Product, type StockReason } from "../api";
import { inventario } from "./client";
import { t } from "./texts";

interface StockDialogProps {
  product: Product;
  onClose(): void;
  /** Se llama cuando las existencias cambiaron y la lista debe recargarse. */
  onChanged(): void;
}

const REASONS: ReadonlyArray<{ value: StockReason; label: string }> = [
  { value: "entrada", label: t("reason.entrada") },
  { value: "conteo", label: t("reason.conteo") },
  { value: "dano", label: t("reason.dano") },
  { value: "perdida", label: t("reason.perdida") },
  { value: "uso", label: t("reason.uso") },
];

const REASON_TEXT: Record<string, string> = {
  entrada: t("reason.entrada"),
  conteo: t("reason.conteo"),
  dano: t("reason.dano"),
  perdida: t("reason.perdida"),
  uso: t("reason.uso"),
  inicial: t("reason.inicial"),
  ajuste: t("reason.ajuste"),
  venta: t("reason.venta"),
  devolucion: t("reason.devolucion"),
  anulacion: t("reason.anulacion"),
};

const signed = new Intl.NumberFormat("es-VE", { signDisplay: "exceptZero" });

/** Las existencias de un producto: registrar lo que llegó, se contó, se dañó o se perdió, y ver su historial. */
export function StockDialog({ product: initial, onClose, onChanged }: StockDialogProps) {
  const currency = useApp().settings["store.currency"];
  const [product, setProduct] = useState(initial);
  const [tab, setTab] = useState<"move" | "history">("move");
  const [reason, setReason] = useState<StockReason>("entrada");
  const [variantId, setVariantId] = useState(initial.variants[0]?.id ?? "");
  const [quantity, setQuantity] = useState("");
  const [cost, setCost] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const history = useData(() => inventario.movements(product.id), [product]);
  const once = useOnce();

  const single = product.variants.length === 1;
  const count = /^\d{1,7}$/.test(quantity.trim()) ? Number(quantity.trim()) : null;
  const quantityInvalid = count === null || (count === 0 && reason !== "conteo");
  const costValue = cost.trim() === "" ? null : parseAmount(cost, currency);
  const costInvalid = reason === "entrada" && cost.trim() !== "" && costValue === null;

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    setDone(null);
    if (quantityInvalid || costInvalid || count === null) return;
    await once(async () => {
      setError(null);
      try {
        const before = product.variants.find((variant) => variant.id === variantId);
        const next = await inventario.move({
          variantId,
          reason,
          quantity: count,
          note,
          unitCost: reason === "entrada" ? (costValue?.amount ?? null) : null,
        });
        const after = next.variants.find((variant) => variant.id === variantId);
        const piece = after ? variantLabel(after) : "";
        setProduct(next);
        setDone(
          before && after && before.stock === after.stock
            ? t("moves.same", { count: after.stock })
            : piece
              ? t("moves.done", { count: after?.stock ?? 0, piece })
              : t("moves.done.single", { count: after?.stock ?? 0 })
        );
        setQuantity("");
        setCost("");
        setNote("");
        setTouched(false);
        onChanged();
      } catch (failure) {
        setError(messageOf(failure));
      }
    });
  }

  const quantityLabel = reason === "entrada" ? t("moves.qty.entrada") : reason === "conteo" ? t("moves.qty.conteo") : t("moves.qty.out");

  return (
    <Dialog
      title={t("moves.title", { name: product.name })}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("moves.close")}
          </button>
          {tab === "move" && (
            <button type="submit" form="stock-form" className="btn btn--primary">
              {t("moves.submit")}
            </button>
          )}
        </>
      }
    >
      <div className="tabs" role="tablist">
        <button type="button" className="tab" role="tab" aria-selected={tab === "move"} onClick={() => setTab("move")}>
          {t("moves.tab.move")}
        </button>
        <button type="button" className="tab" role="tab" aria-selected={tab === "history"} onClick={() => setTab("history")}>
          {t("moves.tab.history")}
        </button>
      </div>

      {tab === "move" && (
        <form id="stock-form" className="stack" onSubmit={submit} noValidate>
          <Segmented
            label={t("moves.reason")}
            showLabel
            value={reason}
            options={REASONS}
            onChange={(value) => {
              setReason(value);
              setDone(null);
            }}
          />
          <div className="form-grid">
            {!single && (
              <Field label={t("moves.piece")}>
                {(props) => (
                  <select {...props} className="input select" value={variantId} onChange={(event) => setVariantId(event.target.value)}>
                    {product.variants.map((variant) => (
                      <option key={variant.id} value={variant.id}>
                        {t("moves.piece.stock", { piece: variantLabel(variant), count: variant.stock })}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            )}
            <Field
              label={quantityLabel}
              error={touched && quantityInvalid ? (reason === "conteo" ? t("moves.qty.invalid.count") : t("moves.qty.invalid")) : null}
              hint={single ? t("moves.piece.stock", { piece: product.name, count: product.variants[0]?.stock ?? 0 }) : undefined}
            >
              {(props) => (
                <input
                  {...props}
                  className="input num"
                  inputMode="numeric"
                  autoComplete="off"
                  data-autofocus=""
                  value={quantity}
                  onChange={(event) => setQuantity(event.target.value)}
                />
              )}
            </Field>
            {reason === "entrada" && (
              <Field label={t("moves.cost")} hint={t("moves.cost.hint")} error={touched && costInvalid ? t("cost.invalid") : null}>
                {(props) => <AmountInput {...props} currency={currency} value={cost} onChange={setCost} />}
              </Field>
            )}
          </div>
          <Field label={t("moves.note")}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={note}
                maxLength={STOCK_NOTE_MAX}
                placeholder={t("moves.note.placeholder")}
                autoComplete="off"
                onChange={(event) => setNote(event.target.value)}
              />
            )}
          </Field>
          {done && (
            <p className="note note--ok" role="status">
              {done}
            </p>
          )}
          <ErrorNote>{error}</ErrorNote>
        </form>
      )}

      {tab === "history" && (
        <>
          <ErrorNote>{history.error}</ErrorNote>
          {history.data && history.data.length === 0 && <p className="muted">{t("moves.empty")}</p>}
          {history.data && history.data.length > 0 && (
            <div className="table-wrap">
              <table className="table table--compact">
                <thead>
                  <tr>
                    <th>{t("moves.col.date")}</th>
                    {!single && <th>{t("moves.col.piece")}</th>}
                    <th>{t("moves.col.reason")}</th>
                    <th className="right">{t("moves.col.qty")}</th>
                    <th className="right">{t("moves.col.balance")}</th>
                    <th>{t("moves.col.note")}</th>
                  </tr>
                </thead>
                <tbody>
                  {history.data.map((movement) => (
                    <tr key={movement.id}>
                      <td className="num">{formatDateTime(movement.createdAt)}</td>
                      {!single && <td>{movement.variant}</td>}
                      <td>{REASON_TEXT[movement.reason] ?? movement.reason}</td>
                      <td className="right num">{signed.format(movement.quantity)}</td>
                      <td className="right num">{movement.balance}</td>
                      <td className="muted">{movement.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Dialog>
  );
}
