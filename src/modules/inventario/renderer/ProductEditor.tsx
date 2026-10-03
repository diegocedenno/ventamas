import { X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { parseAmount } from "@shared/money";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { AmountInput, ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { plainAmount } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { CATEGORY_MAX, CODE_MAX, PRODUCT_NAME_MAX, type Product, type ProductInput } from "../api";
import { inventario } from "./client";
import { t } from "./texts";
import { buildPieces, fromVariants, parseList, pieceKey, type PieceDraft } from "./variants";

interface ProductEditorProps {
  /** El producto a editar, o null para crear uno. */
  product: Product | null;
  onClose(): void;
  /** Se llama cuando algo cambió y la lista debe recargarse. */
  onChanged(): void;
}

const WHOLE = /^-?\d{1,7}$/;

export function ProductEditor({ product, onClose, onChanged }: ProductEditorProps) {
  const currency = useApp().settings["store.currency"];
  const start = useRef(product ? fromVariants(product.variants) : null).current;

  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [price, setPrice] = useState(product ? plainAmount(product.price, currency) : "");
  const [cost, setCost] = useState(product?.cost != null ? plainAmount(product.cost, currency) : "");
  const [sizes, setSizes] = useState(start?.sizes.join(", ") ?? "");
  const [colors, setColors] = useState(start?.colors.join(", ") ?? "");
  const [removed, setRemoved] = useState<Set<string>>(start?.removed ?? new Set());
  const [pieces, setPieces] = useState<PieceDraft[]>(start?.pieces ?? buildPieces([], [], [], new Set()));
  // Todo lo escrito en alguna pieza, aunque su talla se haya quitado: si vuelve, no se pierde.
  const memory = useRef(new Map(pieces.map((piece) => [pieceKey(piece.size, piece.color), piece])));

  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const priceValue = parseAmount(price, currency);
  const costValue = cost.trim() === "" ? null : parseAmount(cost, currency);
  const costInvalid = cost.trim() !== "" && costValue === null;
  const stockInvalid = pieces.some((piece) => !WHOLE.test(piece.stock.trim()));
  const hasGrid = pieces.length > 1 || pieces[0]?.size !== "" || pieces[0]?.color !== "";
  const showSize = pieces.some((piece) => piece.size !== "");
  const showColor = pieces.some((piece) => piece.color !== "");

  function regenerate(nextSizes: string, nextColors: string, nextRemoved: Set<string>) {
    setPieces(buildPieces(parseList(nextSizes), parseList(nextColors), [...memory.current.values()], nextRemoved));
  }

  function editPiece(index: number, change: Partial<PieceDraft>) {
    setPieces((current) =>
      current.map((piece, i) => {
        if (i !== index) return piece;
        const next = { ...piece, ...change };
        memory.current.set(pieceKey(next.size, next.color), next);
        return next;
      })
    );
  }

  function removePiece(piece: PieceDraft) {
    const next = new Set(removed).add(pieceKey(piece.size, piece.color));
    setRemoved(next);
    regenerate(sizes, colors, next);
  }

  function restoreRemoved() {
    setRemoved(new Set());
    regenerate(sizes, colors, new Set());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (name.trim() === "" || priceValue === null || costInvalid || stockInvalid) return;

    const input: ProductInput = {
      id: product?.id,
      name,
      category,
      price: priceValue.amount,
      cost: costValue?.amount ?? null,
      variants: pieces.map((piece) => ({
        id: piece.id,
        size: piece.size,
        color: piece.color,
        code: piece.code,
        stock: Number(piece.stock.trim()),
      })),
    };
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        await inventario.save(input);
        onChanged();
        onClose();
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  async function toggleActive() {
    if (!product) return;
    await once(async () => {
      setBusy(true);
      setError(null);
      try {
        await inventario.setActive(product.id, !product.active);
        onChanged();
        onClose();
      } catch (reason) {
        setError(messageOf(reason));
        setBusy(false);
      }
    });
  }

  // Cuántas combinaciones quitadas siguen siendo posibles con las listas actuales.
  const hidden = buildPieces(parseList(sizes), parseList(colors), [], new Set()).length - pieces.length;

  return (
    <Dialog
      title={product ? t("editor.edit") : t("editor.new")}
      size="lg"
      onClose={onClose}
      dismissible={!busy}
      footer={
        <>
          {product && (
            <button type="button" className="btn btn--quiet spacer" disabled={busy} onClick={() => void toggleActive()}>
              {product.active ? t("retire") : t("reactivate")}
            </button>
          )}
          <button type="button" className="btn" disabled={busy} onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="product-form" className="btn btn--primary" disabled={busy}>
            {t("save")}
          </button>
        </>
      }
    >
      <form id="product-form" className="product-form" onSubmit={submit} noValidate>
        {product && !product.active && <p className="note note--info">{t("retired.note")}</p>}

        <div className="form-grid">
          <Field label={t("name")} error={touched && name.trim() === "" ? t("name.required") : null}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={name}
                maxLength={PRODUCT_NAME_MAX}
                placeholder={t("name.placeholder")}
                autoComplete="off"
                autoFocus={!product}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("category")}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={category}
                maxLength={CATEGORY_MAX}
                placeholder={t("category.placeholder")}
                autoComplete="off"
                onChange={(event) => setCategory(event.target.value)}
              />
            )}
          </Field>
        </div>

        <div className="form-grid">
          <Field label={t("price")} error={touched && priceValue === null ? t("price.invalid") : null}>
            {(props) => <AmountInput {...props} currency={currency} value={price} onChange={setPrice} />}
          </Field>
          <Field label={t("cost")} hint={t("cost.hint")} error={touched && costInvalid ? t("cost.invalid") : null}>
            {(props) => <AmountInput {...props} currency={currency} value={cost} onChange={setCost} />}
          </Field>
        </div>

        <div className="form-grid">
          <Field label={t("sizes")}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={sizes}
                placeholder={t("sizes.placeholder")}
                autoComplete="off"
                onChange={(event) => {
                  setSizes(event.target.value);
                  regenerate(event.target.value, colors, removed);
                }}
              />
            )}
          </Field>
          <Field label={t("colors")}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={colors}
                placeholder={t("colors.placeholder")}
                autoComplete="off"
                onChange={(event) => {
                  setColors(event.target.value);
                  regenerate(sizes, event.target.value, removed);
                }}
              />
            )}
          </Field>
        </div>
        <p className="field-hint product-variants-hint">{t("variants.hint")}</p>

        <section className="section" aria-labelledby="pieces-title">
          <div>
            <h3 className="section-title" id="pieces-title">
              {t("pieces.title")}
            </h3>
            <p className="field-hint">{t("pieces.hint")}</p>
          </div>
          <div className="table-wrap">
            <table className="table table--compact pieces">
              <thead>
                <tr>
                  {showSize && <th>{t("col.size")}</th>}
                  {showColor && <th>{t("col.color")}</th>}
                  <th>{t("col.code")}</th>
                  <th className="right">{t("col.qty")}</th>
                  {hasGrid && pieces.length > 1 && <th />}
                </tr>
              </thead>
              <tbody>
                {pieces.map((piece, index) => {
                  const label = [piece.size, piece.color].filter(Boolean).join(" ");
                  return (
                    <tr key={pieceKey(piece.size, piece.color)}>
                      {showSize && <td>{piece.size}</td>}
                      {showColor && <td>{piece.color}</td>}
                      <td>
                        <input
                          className="input"
                          aria-label={`${t("col.code")} ${label}`.trim()}
                          value={piece.code}
                          maxLength={CODE_MAX}
                          autoComplete="off"
                          spellCheck={false}
                          onChange={(event) => editPiece(index, { code: event.target.value })}
                        />
                      </td>
                      <td className="pieces-stock">
                        <input
                          className="input num"
                          aria-label={`${t("col.qty")} ${label}`.trim()}
                          aria-invalid={touched && !WHOLE.test(piece.stock.trim()) ? true : undefined}
                          inputMode="numeric"
                          autoComplete="off"
                          value={piece.stock}
                          onFocus={(event) => event.target.select()}
                          onChange={(event) => editPiece(index, { stock: event.target.value })}
                        />
                      </td>
                      {hasGrid && pieces.length > 1 && (
                        <td className="pieces-remove">
                          <button
                            type="button"
                            className="icon-btn icon-btn--danger"
                            aria-label={t("remove", { piece: label })}
                            onClick={() => removePiece(piece)}
                          >
                            <X size={18} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {touched && stockInvalid && <p className="field-error">{t("stock.invalid")}</p>}
          {hidden > 0 && (
            <div>
              <button type="button" className="link" onClick={restoreRemoved}>
                {t("restore", { count: hidden })}
              </button>
            </div>
          )}
        </section>

        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}
