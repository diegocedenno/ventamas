import { cssVariable, getTheme, type ThemeColors, type ThemeId } from "@shared/themes";

/** Aplica un tema a toda la ventana escribiendo sus colores como variables CSS. */
export function applyTheme(id: ThemeId): void {
  const theme = getTheme(id);
  const root = document.documentElement;
  for (const key of Object.keys(theme.colors) as Array<keyof ThemeColors>) {
    root.style.setProperty(cssVariable(key), theme.colors[key]);
  }
  root.style.colorScheme = theme.scheme;
  root.dataset.theme = theme.id;
}
