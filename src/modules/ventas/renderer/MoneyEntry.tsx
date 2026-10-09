import { useState, type FormEvent } from "react";
import { parseAmount } from "@shared/money";
import { Chip } from "../../../renderer/src/components/Choices";
import { AmountInput } from "../../../renderer/src/components/Fields";
import { formatMoney, plainAmount } from "../../../renderer/src/lib/format";
import type { PaymentMethod } from "../../caja/api";
import { PAYMENT_NOTE_MAX } from "../api";
import { suggestTenders } from "../tenders";
import { t } from "./texts";

interface MoneyEntryProps {
  method: PaymentMethod;
  mode: "pago" | "vuelto";
  /** Lo que falta, en la moneda del medio: es el monto que se propone. */
  suggested: number;
  onAdd(amount: number, note: string): void;
  onCancel(): void;
}

/** El monto de un pago o de un vuelto. En efectivo ofrece los billetes habituales con un toque. */
export function MoneyEntry({ method, mode, suggested, onAdd, onCancel }: MoneyEntryProps) {
  const [amount, setAmount] = useState(suggested > 0 ? plainAmount(suggested, method.currency) : "");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const value = parseAmount(amount, method.currency);
  const invalid = value === null || value.amount <= 0;
  const withNote = mode === "pago" && method.kind === "electronico";
  const quick = mode === "pago" && method.kind === "efectivo" ? suggestTenders(suggested, method.currency) : [];

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
      {quick.length > 0 && (
        <div className="chips" role="group" aria-label={t("entry.quick")}>
          <Chip onClick={() => onAdd(suggested, "")}>{t("entry.exact")}</Chip>
          {quick.map((tender) => (
            <Chip key={tender} onClick={() => onAdd(tender, "")}>
              {formatMoney(tender, method.currency)}
            </Chip>
          ))}
        </div>
      )}
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
