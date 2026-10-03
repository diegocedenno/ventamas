// Contrato entre la interfaz y el proceso principal. La interfaz no toca la base de
// datos ni el sistema de archivos: todo pasa por estas funciones.

import type { SettingKey, Settings } from "./settings";

export interface AppInfo {
  version: string;
  /** Carpeta donde viven los datos de la tienda. */
  dataDir: string;
  electron: string;
}

export interface BootData {
  settings: Settings;
  info: AppInfo;
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

export interface VentamasApi {
  /** Estado inicial, disponible antes del primer pintado. */
  boot: BootData;
  settings: {
    set<K extends SettingKey>(key: K, value: Settings[K]): Promise<Result<Settings>>;
  };
  app: {
    openDataDir(): Promise<void>;
  };
}

export const CHANNELS = {
  boot: "app:boot",
  setSetting: "settings:set",
  openDataDir: "app:open-data-dir",
} as const;
