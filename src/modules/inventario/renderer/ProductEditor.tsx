import { Barcode, X } from "lucide-react";
import { useId, useMemo, useRef, useState, type FormEvent } from "react";
import { parseAmount } from "@shared/money";
import { normalize } from "@shared/text";
import { Chip, Segmented } from "../../../renderer/src/components/Choices";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { AmountInput, ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { formatMoney, plainAmount } from "../../../renderer/src/lib/format";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { useApp } from "../../../renderer/src/state";
import { formatTaxRate } from "../../impuestos/api";
import { impuestos } from "../../impuestos/renderer/client";
import {
  CATEGORY_MAX,
  CODE_MAX,
  OPTION_NAME_MAX,
  PRODUCT_NAME_MAX,
  type Category,
  type Product,
  type ProductInput,
  type ProductKind,
} from "../api";
import { inventario } from "./client";
import { t } from "./texts";
import { buildPieces, fromVariants, marginOf, parseList, pieceKey, toggleInList, type PieceDraft } from "./variants";

interface ProductEditorProps {
  /** El producto a editar, o null para crear uno. */
  product: Product | null;
  onClose(): void;
  /** Se llama cuando algo cambió y la lista debe recargarse. */
  onChanged(): void;
}

const WHOLE = /^-?\d{1,7}$/;
const COUNT = /^\d{1,7}$/;
const percent = new Intl.NumberFormat("es-VE", { maximumFractionDigits: 1 });

export function ProductEditor({ product, onClose, onChanged }: ProductEditorProps) {
  const { settings } = useApp();
  const currency = settings["store.currency"];
  const taxEnabled = settings["tax.enabled"];
  const amount = (value: number) => plainAmount(value, currency);
  const start = useRef(product ? fromVariants(product.variants, amount) : null).current;
  const id = useId();

  const categories = useData(() => inventario.categories(), []);
  const taxes = useData(() => (taxEnabled ? impuestos.list() : Promise.resolve([])), [taxEnabled]);

  const [kind, setKind] = useState<ProductKind>(product?.kind ?? "producto");
  const [name, setName] = useState(product?.name ?? "");
  const [category, setCategory] = useState(product?.category ?? "");
  const [price, setPrice] = useState(product ? amount(product.price) : "");
  const [cost, setCost] = useState(product?.cost != null ? amount(product.cost) : "");
  const [openPrice, setOpenPrice] = useState(product?.openPrice ?? false);
  const [taxClass, setTaxClass] = useState(product?.taxClass ?? "general");
  const [minStock, setMinStock] = useState(product?.minStock != null ? String(product.minStock) : "");

  const [withVariants, setWithVariants] = useState(start ? start.values1.length + start.values2.length > 0 : false);
  const [option1, setOption1] = useState(product?.option1 ?? "");
  const [option2, setOption2] = useState(product?.option2 ?? "");
  const [values1, setValues1] = useState(start?.values1.join(", ") ?? "");
  const [values2, setValues2] = useState(start?.values2.join(", ") ?? "");
  const [ownPrices, setOwnPrices] = useState(product?.variants.some((variant) => variant.price !== null) ?? false);
  const [removed, setRemoved] = useState<Set<string>>(start?.removed ?? new Set());
  const [pieces, setPieces] = useState<PieceDraft[]>(start?.pieces ?? buildPieces([], [], [], new Set()));
  // Todo lo escrito en alguna pieza, aunque su variante se haya quitado: si vuelve, no se pierde.
  const memory = useRef(new Map(pieces.map((piece) => [pieceKey(piece.value1, piece.value2), piece])));
  // Quien ya escribió sus variantes no quiere que elegir otra categoría se las cambie.
  const ownVariants = useRef(withVariants);

  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  const service = kind === "servicio";
  const selected = useMemo<Category | undefined>(
    () => (categories.data ?? []).find((item) => normalize(item.name) === normalize(category)),
    [categories.data, category]
  );

  /* ---------- validación ---------- */

  // Con el precio abierto no hay precio que guardar: se escribe en cada venta.
  const priceValue = openPrice ? { amount: 0 } : parseAmount(price, currency);
  const costValue = cost.trim() === "" ? null : parseAmount(cost, currency);
  const costInvalid = cost.trim() !== "" && costValue === null;
  const minInvalid = minStock.trim() !== "" && !COUNT.test(minStock.trim());
  const stockInvalid = !service && pieces.some((piece) => !WHOLE.test(piece.stock.trim()));
  const piecePriceInvalid = ownPrices && pieces.some((piece) => piece.price.trim() !== "" && parseAmount(piece.price, currency) === null);
  const list1 = withVariants ? parseList(values1) : [];
  const list2 = withVariants ? parseList(values2) : [];
  const name1Missing = list1.length > 0 && option1.trim() === "";
  const name2Missing = list2.length > 0 && option2.trim() === "";
  const sameNames = list1.length > 0 && list2.length > 0 && normalize(option1) === normalize(option2) && option1.trim() !== "";
  const margin = priceValue && !openPrice ? marginOf(priceValue.amount, costValue?.amount ?? null) : null;

  const showValue1 = pieces.some((piece) => piece.value1 !== "");
  const showValue2 = pieces.some((piece) => piece.value2 !== "");
  const many = pieces.length > 1;
  const showPieces = !service || many || pieces[0]?.value1 !== "" || pieces[0]?.value2 !== "";

  /* ---------- variantes ---------- */

  function regenerate(next1: string, next2: string, nextRemoved: Set<string>, enabled = withVariants) {
    const first = enabled ? parseList(next1) : [];
    const second = enabled ? parseList(next2) : [];
    setPieces(buildPieces(first, second, [...memory.current.values()], nextRemoved));
  }

  function changeValues(axis: 1 | 2, text: string) {
    ownVariants.current = true;
    if (axis === 1) setValues1(text);
    else setValues2(text);
    regenerate(axis === 1 ? text : values1, axis === 2 ? text : values2, removed);
  }

  function toggleVariants(enabled: boolean) {
    setWithVariants(enabled);
    regenerate(values1, values2, removed, enabled);
  }

  function chooseCategory(text: string) {
    setCategory(text);
    const found = (categories.data ?? []).find((item) => normalize(item.name) === normalize(text));
    if (!found || product) return;
    // Un producto nuevo toma el tipo y las variantes de su categoría, mientras no haya escrito las suyas.
    if (found.kind !== kind) setKind(found.kind);
    if (ownVariants.current || found.option1 === "") return;
    setOption1(found.option1);
    setOption2(found.option2);
    setWithVariants(true);
  }

  /** Los valores habituales de la categoría para un eje, si se llama igual. */
  function suggestions(optionName: string): string[] {
    if (!selected || optionName.trim() === "") return [];
    const key = normalize(optionName);
    if (key === normalize(selected.option1)) return selected.values1;
    if (key === normalize(selected.option2)) return selected.values2;
    return [];
  }

  function editPiece(index: number, change: Partial<PieceDraft>) {
    setPieces((current) =>
      current.map((piece, i) => {
        if (i !== index) return piece;
        const next = { ...piece, ...change };
        memory.current.set(pieceKey(next.value1, next.value2), next);
        return next;
      })
    );
  }

  function removePiece(piece: PieceDraft) {
    const next = new Set(removed).add(pieceKey(piece.value1, piece.value2));
    setRemoved(next);
    regenerate(values1, values2, next);
  }

  function restoreRemoved() {
    setRemoved(new Set());
    regenerate(values1, values2, new Set());
  }

  async function generateCodes() {
    setError(null);
    try {
      const used = pieces.map((piece) => piece.code.trim()).filter(Boolean);
      const next = [...pieces];
      for (let index = 0; index < next.length; index++) {
        const piece = next[index];
        if (!piece || piece.code.trim() !== "") continue;
        const code = await inventario.suggestCode(used);
        used.push(code);
        next[index] = { ...piece, code };
        memory.current.set(pieceKey(piece.value1, piece.value2), next[index] as PieceDraft);
      }
      setPieces(next);
    } catch (reason) {
      setError(messageOf(reason));
    }
  }

  /* ---------- guardar ---------- */

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (name.trim() === "" || priceValue === null || costInvalid || minInvalid || stockInvalid || piecePriceInvalid) return;
    if (name1Missing || name2Missing || sameNames) return;

    const input: ProductInput = {
      id: product?.id,
      name,
      kind,
      category,
      price: priceValue.amount,
      cost: costValue?.amount ?? null,
      option1: list1.length ? option1 : "",
      option2: list2.length ? option2 : "",
      minStock: service || minStock.trim() === "" ? null : Number(minStock.trim()),
      openPrice,
      taxClass,
      variants: pieces.map((piece) => ({
        id: piece.id,
        value1: piece.value1,
        value2: piece.value2,
        code: piece.code,
        stock: service ? 0 : Number(piece.stock.trim()),
        price: ownPrices && piece.price.trim() !== "" ? (parseAmount(piece.price, currency)?.amount ?? null) : null,
        cost: piece.cost.trim() !== "" ? (parseAmount(piece.cost, currency)?.amount ?? null) : null,
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
  const hidden = buildPieces(list1, list2, [], new Set()).length - pieces.length;
  const title = product ? (service ? t("editor.edit.service") : t("editor.edit")) : service ? t("editor.new.service") : t("editor.new");
  const taxOptions = (taxes.data ?? []).filter((tax) => tax.active || tax.id === taxClass);

  const axis = (index: 1 | 2) => {
    const optionName = index === 1 ? option1 : option2;
    const values = index === 1 ? values1 : values2;
    const chosen = new Set(parseList(values).map(normalize));
    const missing = touched && (index === 1 ? name1Missing : name2Missing);
    return (
      <div className="axis">
        <Field
          label={index === 1 ? t("option1") : t("option2")}
          error={missing ? t("option.required") : touched && index === 2 && sameNames ? t("option.same") : null}
        >
          {(props) => (
            <input
              {...props}
              className="input"
              value={optionName}
              maxLength={OPTION_NAME_MAX}
              placeholder={index === 1 ? t("option.placeholder1") : t("option.placeholder2")}
              autoComplete="off"
              onChange={(event) => {
                ownVariants.current = true;
                if (index === 1) setOption1(event.target.value);
                else setOption2(event.target.value);
              }}
            />
          )}
        </Field>
        <div className="axis-values">
          <Field label={index === 1 ? t("values1") : t("values2")}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={values}
                placeholder={t("values.placeholder")}
                autoComplete="off"
                onChange={(event) => changeValues(index, event.target.value)}
              />
            )}
          </Field>
          {suggestions(optionName).length > 0 && (
            <div className="chips" role="group" aria-label={`${t("values.suggested")} ${optionName}`}>
              <span className="field-hint axis-suggested">{t("values.suggested")}</span>
              {suggestions(optionName).map((value) => (
                <Chip key={value} pressed={chosen.has(normalize(value))} onClick={() => changeValues(index, toggleInList(values, value))}>
                  {value}
                </Chip>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Dialog
      title={title}
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

        {!product && (
          <div className="stack">
            <Segmented
              label={t("kind")}
              value={kind}
              options={[
                { value: "producto", label: t("kind.product") },
                { value: "servicio", label: t("kind.service") },
              ]}
              onChange={setKind}
            />
            {service && <p className="field-hint">{t("kind.service.hint")}</p>}
          </div>
        )}

        <div className="form-grid">
          <Field label={t("name")} error={touched && name.trim() === "" ? t("name.required") : null}>
            {(props) => (
              <input
                {...props}
                className="input"
                value={name}
                maxLength={PRODUCT_NAME_MAX}
                placeholder={service ? t("name.placeholder.service") : t("name.placeholder")}
                autoComplete="off"
                autoFocus={!product}
                onChange={(event) => setName(event.target.value)}
              />
            )}
          </Field>
          <Field label={t("category")}>
            {(props) => (
              <>
                <input
                  {...props}
                  className="input"
                  list={`${id}-categories`}
                  value={category}
                  maxLength={CATEGORY_MAX}
                  placeholder={t("category.placeholder")}
                  autoComplete="off"
                  onChange={(event) => chooseCategory(event.target.value)}
                />
                <datalist id={`${id}-categories`}>
                  {(categories.data ?? []).map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
        </div>

        <div className="form-grid">
          <Field
            label={t("price")}
            error={touched && priceValue === null ? t("price.invalid") : null}
            hint={
              margin &&
              (margin.profit < 0
                ? t("margin.loss", { loss: formatMoney(-margin.profit, currency) })
                : t("margin", { profit: formatMoney(margin.profit, currency), margin: percent.format(margin.margin / 10) }))
            }
          >
            {(props) => <AmountInput {...props} currency={currency} value={price} onChange={setPrice} disabled={openPrice} />}
          </Field>
          <Field label={t("cost")} hint={t("cost.hint")} error={touched && costInvalid ? t("cost.invalid") : null}>
            {(props) => <AmountInput {...props} currency={currency} value={cost} onChange={setCost} />}
          </Field>
          {taxEnabled && (
            <Field label={t("tax")}>
              {(props) => (
                <select {...props} className="input select" value={taxClass} onChange={(event) => setTaxClass(event.target.value)}>
                  {taxOptions.map((tax) => (
                    <option key={tax.id} value={tax.id}>
                      {tax.name} · {formatTaxRate(tax.rate)}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        <label className="check">
          <input
            type="checkbox"
            checked={openPrice}
            onChange={(event) => setOpenPrice(event.target.checked)}
          />
          <span>
            {t("openPrice")} <span className="muted">· {t("openPrice.hint")}</span>
          </span>
        </label>

        <section className="section" aria-labelledby={`${id}-variants`}>
          <h3 className="section-title" id={`${id}-variants`}>
            {service ? t("variants.title.service") : t("variants.title")}
          </h3>
          <label className="check">
            <input type="checkbox" checked={withVariants} onChange={(event) => toggleVariants(event.target.checked)} />
            {service ? t("variants.toggle.service") : t("variants.toggle")}
          </label>
          {withVariants && (
            <>
              <p className="field-hint">{service ? t("variants.hint.service") : t("variants.hint")}</p>
              {axis(1)}
              {axis(2)}
              <label className="check">
                <input type="checkbox" checked={ownPrices} onChange={(event) => setOwnPrices(event.target.checked)} />
                {t("ownPrices")}
              </label>
            </>
          )}
        </section>

        {showPieces && (
          <section className="section" aria-labelledby={`${id}-pieces`}>
            <div>
              <h3 className="section-title" id={`${id}-pieces`}>
                {service ? t("pieces.title.service") : t("pieces.title")}
              </h3>
              <p className="field-hint">{service ? t("pieces.hint.service") : t("pieces.hint")}</p>
            </div>
            <div className="table-wrap">
              <table className="table table--compact pieces">
                <thead>
                  <tr>
                    {showValue1 && <th>{option1 || t("option1")}</th>}
                    {showValue2 && <th>{option2 || t("option2")}</th>}
                    <th>{t("col.code")}</th>
                    {!service && <th className="right">{t("col.qty")}</th>}
                    {ownPrices && many && <th className="right">{t("col.piecePrice")}</th>}
                    {many && <th />}
                  </tr>
                </thead>
                <tbody>
                  {pieces.map((piece, index) => {
                    const label = [piece.value1, piece.value2].filter(Boolean).join(" ");
                    return (
                      <tr key={pieceKey(piece.value1, piece.value2)}>
                        {showValue1 && <td>{piece.value1}</td>}
                        {showValue2 && <td>{piece.value2}</td>}
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
                        {!service && (
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
                        )}
                        {ownPrices && many && (
                          <td className="pieces-price">
                            <AmountInput
                              currency={currency}
                              aria-label={`${t("col.piecePrice")} ${label}`.trim()}
                              aria-invalid={touched && piece.price.trim() !== "" && parseAmount(piece.price, currency) === null ? true : undefined}
                              placeholder={price}
                              value={piece.price}
                              onChange={(value) => editPiece(index, { price: value })}
                            />
                          </td>
                        )}
                        {many && (
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
            {touched && piecePriceInvalid && <p className="field-error">{t("piecePrice.invalid")}</p>}
            <div className="row">
              {pieces.some((piece) => piece.code.trim() === "") && (
                <button type="button" className="btn" title={t("codes.hint")} onClick={() => void generateCodes()}>
                  <Barcode size={20} strokeWidth={1.75} aria-hidden="true" />
                  {t("codes.generate")}
                </button>
              )}
              {hidden > 0 && (
                <button type="button" className="link" onClick={restoreRemoved}>
                  {hidden === 1 ? t("restore.one") : t("restore", { count: hidden })}
                </button>
              )}
            </div>
          </section>
        )}

        {!service && (
          <div className="min-stock">
            <Field label={t("minStock")} hint={t("minStock.hint")} error={touched && minInvalid ? t("minStock.invalid") : null}>
              {(props) => (
                <span className="min-stock-row">
                  <input
                    {...props}
                    className="input num"
                    inputMode="numeric"
                    autoComplete="off"
                    value={minStock}
                    onChange={(event) => setMinStock(event.target.value)}
                  />
                  <span className="muted">{t("minStock.suffix")}</span>
                </span>
              )}
            </Field>
          </div>
        )}

        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}
