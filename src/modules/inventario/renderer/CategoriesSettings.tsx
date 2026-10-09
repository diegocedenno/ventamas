import { Check, Plus } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Segmented } from "../../../renderer/src/components/Choices";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote, Field } from "../../../renderer/src/components/Fields";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import { useOnce } from "../../../renderer/src/lib/useOnce";
import { CATEGORY_MAX, OPTION_NAME_MAX, type Category, type ProductKind, type RubroInfo } from "../api";
import { inventario } from "./client";
import { t } from "./texts";
import { parseList } from "./variants";

const FIRST_RUBROS = 6;

interface RubroCardsProps {
  rubros: readonly RubroInfo[];
  /** Rubros marcados en el asistente; en Ajustes no se usa. */
  selected?: ReadonlySet<string>;
  onToggle?(id: string): void;
  onLoad?(rubro: RubroInfo): void;
  busy?: string | null;
}

/** Los tipos de comercio del catálogo, como tarjetas: para elegirlos (asistente) o cargarlos (Ajustes). */
export function RubroCards({ rubros, selected, onToggle, onLoad, busy }: RubroCardsProps) {
  return (
    <ul className="rubros">
      {rubros.map((rubro) => {
        const body = (
          <>
            <span className="rubro-name">{rubro.name}</span>
            <span className="rubro-sample muted">{rubro.sample.join(" · ")}…</span>
          </>
        );
        if (onToggle) {
          return (
            <li key={rubro.id}>
              <label className="rubro rubro--choice">
                <input className="sr-only" type="checkbox" checked={selected?.has(rubro.id) ?? false} onChange={() => onToggle(rubro.id)} />
                <span className="rubro-mark" aria-hidden="true">
                  <Check size={16} strokeWidth={2.5} />
                </span>
                <span className="rubro-text">{body}</span>
              </label>
            </li>
          );
        }
        return (
          <li key={rubro.id} className="rubro">
            <span className="rubro-text">
              {body}
              <span className="rubro-count muted">{t("cats.rubro.count", { count: rubro.categoryCount })}</span>
            </span>
            {rubro.loaded ? (
              <span className="badge badge--accent">
                <Check size={14} strokeWidth={2.5} aria-hidden="true" />
                {t("cats.rubro.loaded")}
              </span>
            ) : (
              <button
                type="button"
                className="btn"
                disabled={busy === rubro.id}
                aria-label={t("cats.rubro.load.label", { name: rubro.name })}
                onClick={() => onLoad?.(rubro)}
              >
                {t("cats.rubro.load")}
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Bloque de Ajustes: los tipos de comercio cargados y las categorías de la tienda. */
export function CategoriesSettings() {
  const rubros = useData(() => inventario.rubros(), []);
  const [showHidden, setShowHidden] = useState(false);
  const categories = useData(() => inventario.categories(showHidden), [showHidden]);
  const [allRubros, setAllRubros] = useState(false);
  // undefined: cerrado · null: categoría nueva · Category: edición
  const [editing, setEditing] = useState<Category | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function load(rubro: RubroInfo) {
    setBusy(rubro.id);
    setError(null);
    setDone(null);
    try {
      const result = await inventario.loadRubro(rubro.id);
      setDone(
        result.added > 0 ? t("cats.rubro.added", { count: result.added, name: rubro.name }) : t("cats.rubro.added.none", { name: rubro.name })
      );
      await Promise.all([rubros.reload(), categories.reload()]);
    } catch (reason) {
      setError(messageOf(reason));
    } finally {
      setBusy(null);
    }
  }

  const all = rubros.data ?? [];
  // Los cargados van primero; el resto se despliega al pedirlo.
  const sorted = [...all].sort((a, b) => Number(b.loaded) - Number(a.loaded));
  const visible = allRubros ? sorted : sorted.slice(0, Math.max(FIRST_RUBROS, all.filter((rubro) => rubro.loaded).length));
  const list = categories.data ?? [];

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("cats.title")}
      </h2>
      <p className="section-hint">{t("cats.hint")}</p>

      <div className="stack">
        <h3 className="subsection-title">{t("cats.rubros")}</h3>
        <RubroCards rubros={visible} onLoad={(rubro) => void load(rubro)} busy={busy} />
        {all.length > visible.length || allRubros ? (
          <div>
            <button type="button" className="link" onClick={() => setAllRubros(!allRubros)}>
              {allRubros ? t("cats.rubro.less") : t("cats.rubro.more", { count: all.length })}
            </button>
          </div>
        ) : null}
        {done && (
          <p className="note note--ok" role="status">
            {done}
          </p>
        )}
      </div>

      <div className="stack">
        <div className="row row--between">
          <h3 className="subsection-title">{t("cats.list")}</h3>
          <div className="row">
            <label className="check">
              <input type="checkbox" checked={showHidden} onChange={(event) => setShowHidden(event.target.checked)} />
              {t("cats.showHidden")}
            </label>
            <button type="button" className="btn" onClick={() => setEditing(null)}>
              <Plus size={20} strokeWidth={2} aria-hidden="true" />
              {t("cats.new")}
            </button>
          </div>
        </div>
        {categories.data && list.length === 0 && <p className="muted">{t("cats.list.empty")}</p>}
        {list.length > 0 && (
          <div className="table-wrap cats-table">
            <table className="table table--compact">
              <thead>
                <tr>
                  <th>{t("cats.col.name")}</th>
                  <th>{t("cats.col.variants")}</th>
                  <th className="right">{t("cats.col.products")}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {list.map((category) => (
                  <tr key={category.id}>
                    <td>
                      {category.name} {category.kind === "servicio" && <span className="badge badge--accent">{t("service")}</span>}{" "}
                      {!category.active && <span className="badge">{t("cats.hidden")}</span>}
                    </td>
                    <td className="muted">{[category.option1, category.option2].filter(Boolean).join(" · ") || t("cats.variants.none")}</td>
                    <td className="right num">{category.productCount}</td>
                    <td className="right">
                      <button type="button" className="link" aria-label={`${t("cats.edit")} ${category.name}`} onClick={() => setEditing(category)}>
                        {t("cats.edit")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ErrorNote>{error ?? rubros.error ?? categories.error}</ErrorNote>
      {editing !== undefined && (
        <CategoryEditor category={editing} onClose={() => setEditing(undefined)} onSaved={() => void categories.reload()} />
      )}
    </section>
  );
}

function CategoryEditor({ category, onClose, onSaved }: { category: Category | null; onClose(): void; onSaved(): void }) {
  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<ProductKind>(category?.kind ?? "producto");
  const [option1, setOption1] = useState(category?.option1 ?? "");
  const [values1, setValues1] = useState(category?.values1.join(", ") ?? "");
  const [option2, setOption2] = useState(category?.option2 ?? "");
  const [values2, setValues2] = useState(category?.values2.join(", ") ?? "");
  const [hidden, setHidden] = useState(category ? !category.active : false);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const once = useOnce();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (name.trim() === "") return;
    await once(async () => {
      try {
        await inventario.saveCategory({
          id: category?.id,
          name,
          kind,
          option1,
          values1: parseList(values1),
          option2,
          values2: parseList(values2),
          active: !hidden,
        });
        onSaved();
        onClose();
      } catch (reason) {
        setError(messageOf(reason));
      }
    });
  }

  const axis = (index: 1 | 2) => (
    <div className="axis">
      <Field label={index === 1 ? t("cats.option1") : t("cats.option2")}>
        {(props) => (
          <input
            {...props}
            className="input"
            value={index === 1 ? option1 : option2}
            maxLength={OPTION_NAME_MAX}
            placeholder={index === 1 ? t("option.placeholder1") : t("option.placeholder2")}
            autoComplete="off"
            onChange={(event) => (index === 1 ? setOption1 : setOption2)(event.target.value)}
          />
        )}
      </Field>
      <Field label={`${t("cats.values")} · ${index === 1 ? t("cats.option1") : t("cats.option2")}`}>
        {(props) => (
          <input
            {...props}
            className="input"
            value={index === 1 ? values1 : values2}
            placeholder={t("values.placeholder")}
            autoComplete="off"
            onChange={(event) => (index === 1 ? setValues1 : setValues2)(event.target.value)}
          />
        )}
      </Field>
    </div>
  );

  return (
    <Dialog
      title={category ? t("cats.editor.edit") : t("cats.editor.new")}
      size="lg"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="btn" onClick={onClose}>
            {t("cancel")}
          </button>
          <button type="submit" form="category-form" className="btn btn--primary">
            {t("save")}
          </button>
        </>
      }
    >
      <form id="category-form" className="stack" onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field label={t("cats.name")} error={touched && name.trim() === "" ? t("cats.name.required") : null}>
            {(props) => (
              <input {...props} className="input" value={name} maxLength={CATEGORY_MAX} autoComplete="off" onChange={(event) => setName(event.target.value)} />
            )}
          </Field>
          <Segmented
            label={t("cats.kind")}
            showLabel
            value={kind}
            options={[
              { value: "producto", label: t("cats.kind.product") },
              { value: "servicio", label: t("cats.kind.service") },
            ]}
            onChange={setKind}
          />
        </div>
        {axis(1)}
        {axis(2)}
        <p className="field-hint">{t("cats.values.hint")}</p>
        {category && (
          <label className="check">
            <input type="checkbox" checked={hidden} onChange={(event) => setHidden(event.target.checked)} />
            <span>
              {t("cats.active")} <span className="muted">· {t("cats.active.hint")}</span>
            </span>
          </label>
        )}
        <ErrorNote>{error}</ErrorNote>
      </form>
    </Dialog>
  );
}
