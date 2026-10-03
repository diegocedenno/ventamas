import { describe, expect, it } from "vitest";
import { contrast } from "./contrast";
import { cssVariable, DEFAULT_THEME, getTheme, isThemeId, THEMES } from "./themes";

// Texto normal: 4,5:1. Bordes de controles y anillo de foco: 3:1 (WCAG 1.4.11).
const TEXT = 4.5;
const UI = 3;

describe("temas", () => {
  it("son ocho, con identificadores únicos", () => {
    expect(THEMES).toHaveLength(8);
    expect(new Set(THEMES.map((t) => t.id)).size).toBe(8);
    expect(isThemeId(DEFAULT_THEME)).toBe(true);
    expect(isThemeId("no-existe")).toBe(false);
    expect(getTheme(DEFAULT_THEME).id).toBe(DEFAULT_THEME);
  });

  it("nombra las variables CSS en kebab-case", () => {
    expect(cssVariable("accentSoft")).toBe("--accent-soft");
    expect(cssVariable("surface2")).toBe("--surface-2");
    expect(cssVariable("bg")).toBe("--bg");
  });

  describe.each(THEMES.map((theme) => [theme.name, theme] as const))("%s cumple contraste AA", (_name, theme) => {
    const c = theme.colors;
    const pairs: Array<[string, string, string, number]> = [
      ["texto sobre fondo", c.text, c.bg, TEXT],
      ["texto sobre superficie", c.text, c.surface, TEXT],
      ["texto sobre superficie al pasar el cursor", c.text, c.surface2, TEXT],
      ["texto secundario sobre fondo", c.text2, c.bg, TEXT],
      ["texto secundario sobre superficie", c.text2, c.surface, TEXT],
      ["texto secundario sobre superficie al pasar el cursor", c.text2, c.surface2, TEXT],
      ["acento como texto sobre fondo", c.accent, c.bg, TEXT],
      ["acento como texto sobre superficie", c.accent, c.surface, TEXT],
      ["acento sobre su fondo suave", c.accent, c.accentSoft, TEXT],
      ["texto sobre el fondo suave del acento", c.text, c.accentSoft, TEXT],
      ["tinta sobre acento", c.accentInk, c.accent, TEXT],
      ["tinta sobre acento al pasar el cursor", c.accentInk, c.accentHover, TEXT],
      ["peligro sobre superficie", c.danger, c.surface, TEXT],
      ["peligro sobre su fondo suave", c.danger, c.dangerSoft, TEXT],
      ["éxito sobre superficie", c.success, c.surface, TEXT],
      ["aviso sobre superficie", c.warning, c.surface, TEXT],
      ["borde de controles sobre superficie", c.borderStrong, c.surface, UI],
      ["borde de controles sobre fondo", c.borderStrong, c.bg, UI],
      ["foco sobre fondo", c.focus, c.bg, UI],
      ["foco sobre superficie", c.focus, c.surface, UI],
    ];

    it.each(pairs)("%s", (_label, fg, bg, min) => {
      expect(contrast(fg, bg)).toBeGreaterThanOrEqual(min);
    });
  });
});
