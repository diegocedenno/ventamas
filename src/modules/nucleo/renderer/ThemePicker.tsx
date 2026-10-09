import { THEMES, type ThemeId } from "@shared/themes";
import { t } from "./texts";

interface ThemePickerProps {
  value: ThemeId;
  onChange(theme: ThemeId): void;
  /** id del título que nombra al grupo. */
  labelledBy: string;
}

/** Los ocho temas de color, cada uno con una vista en miniatura. */
export function ThemePicker({ value, onChange, labelledBy }: ThemePickerProps) {
  return (
    <div className="themes" role="radiogroup" aria-labelledby={labelledBy}>
      {THEMES.map((theme) => (
        <label key={theme.id} className="theme">
          <input className="sr-only" type="radio" name="tema" value={theme.id} checked={value === theme.id} onChange={() => onChange(theme.id)} />
          <span className="theme-preview" aria-hidden="true" style={{ background: theme.colors.bg, borderColor: theme.colors.border }}>
            <span className="theme-preview-side" style={{ background: theme.colors.surface, borderColor: theme.colors.border }}>
              <i style={{ background: theme.colors.accent }} />
              <i style={{ background: theme.colors.text2 }} />
              <i style={{ background: theme.colors.text2 }} />
            </span>
            <span className="theme-preview-main">
              <i style={{ background: theme.colors.text }} />
              <i style={{ background: theme.colors.accent }} />
            </span>
          </span>
          <span className="theme-name">
            {theme.name}
            {theme.scheme === "dark" && <span className="theme-tag">{t("settings.theme.dark")}</span>}
          </span>
        </label>
      ))}
    </div>
  );
}
