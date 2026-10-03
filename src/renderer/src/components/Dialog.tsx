import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

interface DialogProps {
  title: string;
  /** Se llama al cerrar con Esc, con la X o al terminar. */
  onClose(): void;
  children: ReactNode;
  /** Botones de acción, al pie. */
  footer?: ReactNode;
  size?: "sm" | "md" | "lg";
  /** Si es false, Esc y la X no cierran: hay una operación en curso. */
  dismissible?: boolean;
}

/**
 * Ventana modal sobre el <dialog> nativo: atrapa el foco, se cierra con Esc y devuelve
 * el foco a donde estaba. Se monta abierta; para cerrarla, deja de renderizarla.
 */
export function Dialog({ title, onClose, children, footer, size = "md", dismissible = true }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    const previous = document.activeElement as HTMLElement | null;
    dialog.showModal();
    // El foco empieza en lo marcado con data-autofocus o, si no, en el primer control del
    // contenido; nunca en la X de cerrar.
    const target =
      dialog.querySelector<HTMLElement>("[data-autofocus]") ??
      dialog.querySelector<HTMLElement>(".dialog-body :is(input, select, textarea, button):not(:disabled)") ??
      dialog.querySelector<HTMLElement>(".dialog-foot .btn--primary");
    target?.focus();
    return () => {
      dialog.close();
      previous?.focus?.();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${size}`}
      aria-labelledby={titleId}
      onCancel={(event) => {
        // Esc: el cierre lo decide quien la abrió.
        event.preventDefault();
        if (dismissible) onClose();
      }}
    >
      <header className="dialog-head">
        <h2 className="dialog-title" id={titleId}>
          {title}
        </h2>
        {dismissible && (
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={onClose}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </header>
      <div className="dialog-body">{children}</div>
      {footer && <footer className="dialog-foot">{footer}</footer>}
    </dialog>
  );
}
