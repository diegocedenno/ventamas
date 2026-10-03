// Los ocho temas de color. Esta lista es la única fuente: de aquí salen las variables
// CSS de la interfaz, el selector de Ajustes y la prueba que exige contraste AA.

export interface ThemeColors {
  /** Fondo de la ventana. */
  bg: string;
  /** Tarjetas, paneles y campos. */
  surface: string;
  /** Superficie al pasar el cursor o presionar. */
  surface2: string;
  /** Líneas divisorias. */
  border: string;
  /** Borde de campos y controles: debe verse (3:1). */
  borderStrong: string;
  text: string;
  /** Texto secundario. */
  text2: string;
  /** Color de la tienda: acción principal y elemento activo. */
  accent: string;
  accentHover: string;
  /** Texto sobre el acento. */
  accentInk: string;
  /** Fondo suave del elemento activo. */
  accentSoft: string;
  danger: string;
  dangerSoft: string;
  success: string;
  warning: string;
  /** Anillo de foco del teclado. */
  focus: string;
}

export interface Theme {
  id: string;
  name: string;
  scheme: "light" | "dark";
  colors: ThemeColors;
}

export const THEMES = [
  {
    id: "pizarra",
    name: "Pizarra",
    scheme: "light",
    colors: {
      bg: "#f6f8fa",
      surface: "#ffffff",
      surface2: "#eef2f6",
      border: "#dfe5ec",
      borderStrong: "#78879b",
      text: "#0f172a",
      text2: "#475569",
      accent: "#047857",
      accentHover: "#065f46",
      accentInk: "#ffffff",
      accentSoft: "#e2f5ec",
      danger: "#b91c1c",
      dangerSoft: "#fdeaea",
      success: "#166534",
      warning: "#92400e",
      focus: "#1d4ed8",
    },
  },
  {
    id: "oceano",
    name: "Océano",
    scheme: "light",
    colors: {
      bg: "#f4f7fb",
      surface: "#ffffff",
      surface2: "#e9f0f9",
      border: "#d8e2ef",
      borderStrong: "#73869f",
      text: "#0b1b33",
      text2: "#44546a",
      accent: "#1d4ed8",
      accentHover: "#1e40af",
      accentInk: "#ffffff",
      accentSoft: "#e3ecff",
      danger: "#b91c1c",
      dangerSoft: "#fdeaea",
      success: "#166534",
      warning: "#92400e",
      focus: "#0f766e",
    },
  },
  {
    id: "bosque",
    name: "Bosque",
    scheme: "light",
    colors: {
      bg: "#f5f6f0",
      surface: "#fdfdfb",
      surface2: "#ebeee3",
      border: "#d9decd",
      borderStrong: "#7a8569",
      text: "#1a2415",
      text2: "#4b5743",
      accent: "#3f6212",
      accentHover: "#365314",
      accentInk: "#ffffff",
      accentSoft: "#e6efd6",
      danger: "#b91c1c",
      dangerSoft: "#fbe9e6",
      success: "#166534",
      warning: "#92400e",
      focus: "#1d4ed8",
    },
  },
  {
    id: "terracota",
    name: "Terracota",
    scheme: "light",
    colors: {
      bg: "#f9f5ef",
      surface: "#fffdfa",
      surface2: "#f2e9dd",
      border: "#e5d8c7",
      borderStrong: "#8f7b64",
      text: "#2a1d14",
      text2: "#5f4e40",
      accent: "#a8401a",
      accentHover: "#8a3414",
      accentInk: "#ffffff",
      accentSoft: "#f9e5d9",
      danger: "#b91c1c",
      dangerSoft: "#fbe7e2",
      success: "#166534",
      warning: "#854d0e",
      focus: "#1d4ed8",
    },
  },
  {
    id: "vino",
    name: "Vino",
    scheme: "light",
    colors: {
      bg: "#faf5f6",
      surface: "#ffffff",
      surface2: "#f4e8eb",
      border: "#e9d6db",
      borderStrong: "#96747d",
      text: "#2b1218",
      text2: "#624952",
      accent: "#9f1239",
      accentHover: "#881337",
      accentInk: "#ffffff",
      accentSoft: "#fbe4ea",
      danger: "#b91c1c",
      dangerSoft: "#fdeaea",
      success: "#166534",
      warning: "#92400e",
      focus: "#1d4ed8",
    },
  },
  {
    id: "lavanda",
    name: "Lavanda",
    scheme: "light",
    colors: {
      bg: "#f7f6fb",
      surface: "#ffffff",
      surface2: "#edeaf7",
      border: "#ddd9ee",
      borderStrong: "#7e779f",
      text: "#1c1833",
      text2: "#514b6b",
      accent: "#5b3fc4",
      accentHover: "#4a31a6",
      accentInk: "#ffffff",
      accentSoft: "#eae5fb",
      danger: "#b91c1c",
      dangerSoft: "#fdeaea",
      success: "#166534",
      warning: "#92400e",
      focus: "#0f766e",
    },
  },
  {
    id: "noche",
    name: "Noche",
    scheme: "dark",
    colors: {
      bg: "#0f172a",
      surface: "#172033",
      surface2: "#202b42",
      border: "#2b3852",
      borderStrong: "#7385a1",
      text: "#e8eef7",
      text2: "#a9b6ca",
      accent: "#38bdf8",
      accentHover: "#7dd3fc",
      accentInk: "#06202f",
      accentSoft: "#14354d",
      danger: "#fca5a5",
      dangerSoft: "#4a1f24",
      success: "#86efac",
      warning: "#fcd34d",
      focus: "#fde68a",
    },
  },
  {
    id: "carbon",
    name: "Carbón",
    scheme: "dark",
    colors: {
      bg: "#141414",
      surface: "#1e1e1e",
      surface2: "#292929",
      border: "#363636",
      borderStrong: "#858585",
      text: "#f2f2f2",
      text2: "#b4b4b4",
      accent: "#f5b83d",
      accentHover: "#f8c95f",
      accentInk: "#1f1500",
      accentSoft: "#3a2c0b",
      danger: "#fca5a5",
      dangerSoft: "#4a2020",
      success: "#86efac",
      warning: "#fcd34d",
      focus: "#93c5fd",
    },
  },
] as const satisfies readonly Theme[];

export type ThemeId = (typeof THEMES)[number]["id"];

export const DEFAULT_THEME: ThemeId = "pizarra";

export const THEME_IDS: readonly ThemeId[] = THEMES.map((theme) => theme.id);

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}

export function getTheme(id: ThemeId): Theme {
  return THEMES.find((theme) => theme.id === id) ?? THEMES[0];
}

/** "accentSoft" → "--accent-soft" */
export function cssVariable(key: keyof ThemeColors): string {
  return "--" + key.replace(/[A-Z0-9]/g, (c) => "-" + c.toLowerCase());
}
