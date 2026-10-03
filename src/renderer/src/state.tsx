import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import type { AppInfo } from "@shared/api";
import type { SettingKey, Settings } from "@shared/settings";
import { NUCLEO } from "@modules/nucleo/api";
import { call, messageOf } from "./lib/ipc";
import type { Screen, SettingsSection } from "./modules";
import { applyTheme } from "./theme";

interface AppState {
  settings: Settings;
  info: AppInfo;
  /** Guarda un ajuste. Devuelve un mensaje de error, o null si se guardó. */
  saveSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<string | null>;
  /** Pantalla actual. */
  screen: string;
  goTo(screen: string): void;
  screens: readonly Screen[];
  settingsSections: readonly SettingsSection[];
}

const AppContext = createContext<AppState | null>(null);

interface AppProviderProps {
  screens: readonly Screen[];
  settingsSections: readonly SettingsSection[];
  children: ReactNode;
}

export function AppProvider({ screens, settingsSections, children }: AppProviderProps) {
  const [settings, setSettings] = useState<Settings>(window.ventamas.boot.settings);
  const [screen, setScreen] = useState(screens[0]?.id ?? "");

  const saveSetting = useCallback(async <K extends SettingKey>(key: K, value: Settings[K]) => {
    try {
      const saved = await call<Settings>(NUCLEO.setSetting, key, value);
      setSettings(saved);
      applyTheme(saved["ui.theme"]);
      return null;
    } catch (error) {
      return messageOf(error);
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({ settings, info: window.ventamas.boot.info, saveSetting, screen, goTo: setScreen, screens, settingsSections }),
    [settings, saveSetting, screen, screens, settingsSections]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error("useApp debe usarse dentro de AppProvider");
  return state;
}
