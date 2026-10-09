import { Search, UserPlus } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Dialog } from "../../../renderer/src/components/Dialog";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { messageOf } from "../../../renderer/src/lib/ipc";
import type { Customer } from "../api";
import { clientes } from "./client";
import { CustomerEditor } from "./CustomerEditor";
import { t } from "./texts";

interface CustomerPickerProps {
  /** Hay un cliente puesto: se ofrece quitarlo. */
  current: Customer | null;
  onPick(customer: Customer | null): void;
  onClose(): void;
}

const LIMIT = 8;

/** Elegir el cliente de una venta: se busca por nombre, cédula o teléfono, y si no está se crea ahí mismo. */
export function CustomerPicker({ current, onPick, onClose }: CustomerPickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Customer[] | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ticket = useRef(0);

  useEffect(() => {
    const mine = ++ticket.current;
    const timer = window.setTimeout(
      async () => {
        try {
          const found = await clientes.list(query.trim());
          if (mine !== ticket.current) return;
          setResults(found.slice(0, LIMIT));
          setHighlight(0);
          setError(null);
        } catch (reason) {
          if (mine === ticket.current) setError(messageOf(reason));
        }
      },
      query === "" ? 0 : 120
    );
    return () => window.clearTimeout(timer);
  }, [query]);

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (!results?.length) return;
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setHighlight((value) => (value + step + results.length) % results.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const chosen = results?.[highlight];
      if (chosen) onPick(chosen);
      else if (query.trim() !== "") setCreating(true);
    }
  }

  if (creating) {
    return <CustomerEditor customer={null} draft={query.trim()} onClose={() => setCreating(false)} onSaved={(customer) => onPick(customer)} />;
  }

  const text = query.trim();
  return (
    <Dialog
      title={t("picker.title")}
      onClose={onClose}
      footer={
        <>
          {current && (
            <button type="button" className="btn btn--quiet spacer" onClick={() => onPick(null)}>
              {t("picker.remove")}
            </button>
          )}
          <button type="button" className="btn" onClick={() => setCreating(true)}>
            <UserPlus size={20} strokeWidth={1.75} aria-hidden="true" />
            {text && results?.length === 0 ? t("picker.create.named", { name: text }) : t("picker.create")}
          </button>
        </>
      }
    >
      <label className="search">
        <Search size={20} strokeWidth={1.75} aria-hidden="true" />
        <span className="sr-only">{t("picker.search")}</span>
        <input
          className="input input--search"
          type="text"
          role="combobox"
          aria-expanded={Boolean(results?.length)}
          aria-controls="customer-results"
          aria-activedescendant={results?.[highlight] ? `customer-${results[highlight].id}` : undefined}
          aria-autocomplete="list"
          value={query}
          placeholder={t("picker.placeholder")}
          autoComplete="off"
          spellCheck={false}
          data-autofocus=""
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={onKeyDown}
        />
      </label>
      <ErrorNote>{error}</ErrorNote>
      {results && results.length === 0 && <p className="muted">{text ? t("picker.none", { query: text }) : t("picker.empty")}</p>}
      {results && results.length > 0 && (
        <ul className="picker-list" id="customer-results" role="listbox" aria-label={t("picker.search")}>
          {results.map((customer, index) => (
            <li
              key={customer.id}
              id={`customer-${customer.id}`}
              role="option"
              aria-selected={index === highlight}
              className="picker-item"
              onMouseEnter={() => setHighlight(index)}
              onClick={() => onPick(customer)}
            >
              <span className="picker-item-name">{customer.name}</span>
              <span className="muted num">{[customer.doc, customer.phone].filter(Boolean).join(" · ")}</span>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
