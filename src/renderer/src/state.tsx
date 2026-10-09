import { createContext, useCallback, useContext, useMemo, useState, type ComponentType, type ReactNode } from "react";
import type { AppInfo } from "@shared/api";
import type { SettingKey, Settings } from "@shared/settings";
import { NUCLEO } from "@modules/nucleo/api";
import { call, messageOf } from "./lib/ipc";
import type { Screen, SettingsSection, SlotPiece } from "./modules";
import { applyTheme } from "./theme";

/** Con qué abrir una pantalla: un filtro ya puesto, un registro ya elegido. */
export type ScreenParams = Readonly<Record<string, string>>;

interface AppState {
  settings: Settings;
  info: AppInfo;
  /** Guarda un ajuste. Devuelve un mensaje de error, o null si se guardó. */
  saveSetting<K extends SettingKey>(key: K, value: Settings[K]): Promise<string | null>;
  /** Reemplaza los ajustes por los que devolvió una operación que cambió varios a la vez. */
  applySettings(settings: Settings): void;
  /** Pantalla actual. */
  screen: string;
  /** Con qué se abrió la pantalla actual; vacío si se llegó por el menú. */
  params: ScreenParams;
  goTo(screen: string, params?: ScreenParams): void;
  /** Las pantallas que esta tienda usa, en el orden del menú. */
  screens: readonly Screen[];
  settingsSections: readonly SettingsSection[];
  slots: readonly SlotPiece[];
}

const AppContext = createContext<AppState | null>(null);

interface AppProviderProps {
  screens: readonly Screen[];
  settingsSections: readonly SettingsSection[];
  slots: readonly SlotPiece[];
  children: ReactNode;
}

const NO_PARAMS: ScreenParams = {};

export function AppProvider({ screens, settingsSections, slots, children }: AppProviderProps) {
  const [settings, setSettings] = useState<Settings>(window.ventamas.boot.settings);
  const [place, setPlace] = useState<{ screen: string; params: ScreenParams }>({ screen: screens[0]?.id ?? "", params: NO_PARAMS });

  const applySettings = useCallback((next: Settings) => {
    setSettings(next);
    applyTheme(next["ui.theme"]);
  }, []);

  const saveSetting = useCallback(
    async <K extends SettingKey>(key: K, value: Settings[K]) => {
      try {
        applySettings(await call<Settings>(NUCLEO.setSetting, key, value));
        return null;
      } catch (error) {
        return messageOf(error);
      }
    },
    [applySettings]
  );

  const goTo = useCallback((screen: string, params: ScreenParams = NO_PARAMS) => setPlace({ screen, params }), []);

  // Cada tienda ve solo las pantallas que usa.
  const visible = useMemo(() => screens.filter((screen) => !screen.when || screen.when(settings)), [screens, settings]);

  const value = useMemo<AppState>(
    () => ({
      settings,
      info: window.ventamas.boot.info,
      saveSetting,
      applySettings,
      screen: place.screen,
      params: place.params,
      goTo,
      screens: visible,
      settingsSections,
      slots,
    }),
    [settings, saveSetting, applySettings, place, goTo, visible, settingsSections, slots]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppState {
  const state = useContext(AppContext);
  if (!state) throw new Error("useApp debe usarse dentro de AppProvider");
  return state;
}

/** Las piezas que otros módulos colocaron en un lugar, en su orden. */
export function useSlot<Props>(slot: string): ComponentType<Props>[] {
  const { slots } = useApp();
  return useMemo(
    () => slots.filter((piece) => piece.slot === slot).map((piece) => piece.component as ComponentType<Props>),
    [slots, slot]
  );
}
