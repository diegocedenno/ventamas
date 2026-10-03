/** Minúsculas y sin acentos, para buscar "pantalon" y encontrar "Pantalón". */
export function normalize(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Quita espacios sobrantes de un texto escrito por una persona. */
export function tidy(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}
