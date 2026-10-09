import { useEffect, useRef, useState } from "react";
import { ErrorNote } from "../../../renderer/src/components/Fields";
import { useData } from "../../../renderer/src/lib/useData";
import type { WelcomeStepProps } from "../../nucleo/renderer/welcomeSlot";
import { RubroCards } from "./CategoriesSettings";
import { inventario } from "./client";
import { t } from "./texts";

/** Paso del asistente de bienvenida: qué vende la tienda. Al continuar se cargan sus categorías. */
export function WelcomeRubros({ onCommit }: WelcomeStepProps) {
  const rubros = useData(() => inventario.rubros(), []);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const chosen = useRef(selected);
  chosen.current = selected;

  useEffect(() => {
    onCommit(async () => {
      for (const id of chosen.current) await inventario.loadRubro(id);
    });
  }, [onCommit]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (!next.delete(id)) next.add(id);
    setSelected(next);
  }

  return (
    <>
      <div>
        <h2 className="welcome-title">{t("welcome.title")}</h2>
        <p className="welcome-body">{t("welcome.body")}</p>
      </div>
      <ErrorNote>{rubros.error}</ErrorNote>
      <RubroCards rubros={rubros.data ?? []} selected={selected} onToggle={toggle} />
      <p className="field-hint">{t("welcome.none")}</p>
    </>
  );
}
