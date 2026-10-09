import { useId, type ReactNode } from "react";

interface SegmentedProps<T extends string> {
  /** Qué se está eligiendo; lo leen los lectores de pantalla. */
  label: string;
  /** Muestra la etiqueta encima del control. Si no, queda solo para lectores de pantalla. */
  showLabel?: boolean;
  value: T;
  // El tipo de las opciones lo fija el valor actual, no al revés.
  options: ReadonlyArray<{ value: NoInfer<T>; label: string }>;
  onChange(value: NoInfer<T>): void;
  disabled?: boolean;
}

/** Elegir una entre pocas opciones, todas a la vista. Son botones de radio de verdad: se recorren con las flechas. */
export function Segmented<T extends string>({ label, showLabel = false, value, options, onChange, disabled }: SegmentedProps<T>) {
  const name = useId();
  return (
    <div className="field" role="radiogroup" aria-label={label}>
      {showLabel && (
        <span className="field-label" aria-hidden="true">
          {label}
        </span>
      )}
      <div className="segmented">
        {options.map((option) => (
          <label key={option.value} className="segmented-option">
            <input
              className="sr-only"
              type="radio"
              name={name}
              value={option.value}
              checked={option.value === value}
              disabled={disabled}
              onChange={() => onChange(option.value)}
            />
            <span>{option.label}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

interface ChipProps {
  /** Marcada: el filtro está puesto o el valor ya está elegido. */
  pressed?: boolean;
  onClick(): void;
  children: ReactNode;
  disabled?: boolean;
  title?: string;
}

/** Botón pequeño para filtrar una lista o añadir un valor sugerido con un toque. */
export function Chip({ pressed, onClick, children, disabled, title }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={pressed} disabled={disabled} title={title} onClick={onClick}>
      {children}
    </button>
  );
}
