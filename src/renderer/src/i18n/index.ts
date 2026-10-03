/**
 * Crea la función de textos de un módulo a partir de su diccionario. Cada módulo guarda
 * sus textos en su propio archivo, separados del código, para poder traducirlos después.
 */
export function createT<Dictionary extends Record<string, string>>(dictionary: Dictionary) {
  return function t(key: keyof Dictionary, values?: Record<string, string | number>): string {
    const text = dictionary[key] as string;
    if (!values) return text;
    return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
  };
}
