import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AppInfo } from "@shared/api";
import type { SettingKey, Settings } from "@shared/settings";
import { t } from "./i18n/es";
import { applyTheme } from "./theme";

interface AppState {
  settings: Settings;
  info: AppInfo;
  /** Guarda un ajuste. Devuelve un mensaje de error, o null si se guardó. */
  saveSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<string | null>;
  screen: string;
  goTo(screen: string): void;
}

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ initialScreen, children }: { initialScreen: string; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(window.ventamas.boot.settings);
  const [screen, setScreen] = useState(initialScreen);

  const saveSetting = useCallback(async <K extends SettingKey>(key: K, value: Settings[K]) => {
    try {
      const result = await window.ventamas.settings.set(key, value);
      if (!result.ok) return result.error;
      setSettings(result.value);
      applyTheme(result.value["ui.theme"]);
      return null;
    } catch {
      return t("settings.error");
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({ settings, info: window.ventamas.boot.info, saveSetting, screen, goTo: setScreen }),
    [settings, saveSetting, screen]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error("useApp debe usarse dentro de AppProvider");
  return state;
}
