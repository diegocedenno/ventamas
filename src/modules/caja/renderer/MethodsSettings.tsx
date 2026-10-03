import { useId, useState } from "react";
import { CURRENCIES } from "@shared/money";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { messageOf } from "../../../renderer/src/lib/ipc";
import { useData } from "../../../renderer/src/lib/useData";
import type { PaymentMethod } from "../api";
import { caja } from "./client";
import { t } from "./texts";

/** Bloque de Ajustes: qué medios de pago usa la tienda. */
export function MethodsSettings() {
  const methods = useData(() => caja.methods(), []);
  const [error, setError] = useState<string | null>(null);
  const id = useId();

  async function toggle(method: PaymentMethod) {
    setError(null);
    // El interruptor responde al instante; si el cambio no se puede guardar, vuelve atrás.
    methods.set((methods.data ?? []).map((m) => (m.id === method.id ? { ...m, active: !m.active } : m)));
    try {
      methods.set(await caja.setMethodActive(method.id, !method.active));
    } catch (reason) {
      setError(messageOf(reason));
      void methods.reload();
    }
  }

  return (
    <section className="card section" aria-labelledby={`${id}-title`}>
      <h2 className="section-title" id={`${id}-title`}>
        {t("settings.title")}
      </h2>
      <p className="section-hint">{t("settings.hint")}</p>
      <ul className="methods">
        {(methods.data ?? []).map((method) => (
          <li key={method.id} className="methods-item">
            <label className="methods-label" htmlFor={`${id}-${method.id}`}>
              <span>{method.name}</span>
              <span className="muted">
                {method.kind === "efectivo" ? t("kind.efectivo") : t("kind.electronico")} · {CURRENCIES[method.currency].name}
              </span>
            </label>
            <span className="switch">
              <input id={`${id}-${method.id}`} type="checkbox" role="switch" checked={method.active} onChange={() => void toggle(method)} />
              <span className="switch-track" />
            </span>
          </li>
        ))}
      </ul>
      <ErrorNote>{error ?? methods.error}</ErrorNote>
    </section>
  );
}
