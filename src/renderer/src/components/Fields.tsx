import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from "react";
import { CURRENCIES, type CurrencyCode } from "@shared/money";

interface FieldProps {
  label: string;
  hint?: ReactNode;
  error?: string | null;
  /** Recibe el id del control y los ids que lo describen. */
  children(props: { id: string; "aria-describedby": string | undefined; "aria-invalid": true | undefined }): ReactNode;
}

/** Etiqueta visible, ayuda y error junto a un control. */
export function Field({ label, hint, error, children }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children({
        id,
        "aria-describedby": [errorId, hintId].filter(Boolean).join(" ") || undefined,
        "aria-invalid": error ? true : undefined,
      })}
      {error && (
        <p className="field-error" id={errorId} role="alert">
          {error}
        </p>
      )}
      {hint && !error && (
        <p className="field-hint" id={hintId}>
          {hint}
        </p>
      )}
    </div>
  );
}

interface AmountInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type"> {
  currency: CurrencyCode;
  value: string;
  onChange(value: string): void;
  ref?: Ref<HTMLInputElement>;
}

/** Campo de monto con el símbolo de su moneda. El texto se interpreta con parseAmount. */
export function AmountInput({ currency, value, onChange, className, ref, ...rest }: AmountInputProps) {
  return (
    <span className={`amount ${className ?? ""}`}>
      <span className="amount-symbol" aria-hidden="true">
        {CURRENCIES[currency].symbol}
      </span>
      <input
        {...rest}
        ref={ref}
        className="input amount-input num"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onFocus={(event) => {
          event.target.select();
          rest.onFocus?.(event);
        }}
      />
    </span>
  );
}

/** Mensaje de error de una operación, anunciado a lectores de pantalla. */
export function ErrorNote({ children }: { children: ReactNode }) {
  if (!children) return null;
  return (
    <p className="note note--error" role="alert">
      {children}
    </p>
  );
}

/** Pantalla o lista sin contenido: explica qué falta y ofrece el siguiente paso. */
export function Empty({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h2 className="empty-title">{title}</h2>
      {children && <p className="empty-body">{children}</p>}
      {action}
    </div>
  );
}
