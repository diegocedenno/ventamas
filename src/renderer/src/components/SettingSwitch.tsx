import { useId, useState } from "react";
import type { Settings } from "@shared/settings";
import { useApp } from "../state";

type FlagKey = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

interface SettingSwitchProps {
  /** El ajuste de sí o no que enciende y apaga. */
  setting: FlagKey;
  label: string;
  /** Recibe el mensaje si no se pudo guardar, o null si se guardó. */
  onResult?(error: string | null): void;
}

/**
 * Interruptor de un ajuste de la tienda. Responde al instante y guarda después; si el
 * cambio no se puede guardar, vuelve a donde estaba.
 */
export function SettingSwitch({ setting, label, onResult }: SettingSwitchProps) {
  const { settings, saveSetting } = useApp();
  const [pending, setPending] = useState<boolean | null>(null);
  const id = useId();

  async function change(next: boolean) {
    setPending(next);
    const error = await saveSetting(setting, next);
    setPending(null);
    onResult?.(error);
  }

  return (
    <label className="setting-switch" htmlFor={id}>
      <span>{label}</span>
      <span className="switch">
        <input id={id} type="checkbox" role="switch" checked={pending ?? settings[setting]} onChange={(event) => void change(event.target.checked)} />
        <span className="switch-track" />
      </span>
    </label>
  );
}
