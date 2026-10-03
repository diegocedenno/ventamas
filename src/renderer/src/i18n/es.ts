// Todos los textos de la interfaz viven aquí, separados del código, para poder
// traducirlos después. Se escriben con palabras de tienda, sin jerga contable.

export const es = {
  "app.name": "Ventamas",
  "app.skip": "Saltar al contenido",

  "nav.label": "Secciones",
  "nav.home": "Inicio",
  "nav.settings": "Ajustes",

  "store.unnamed": "Tu tienda",

  "home.greeting": "Hola",
  "home.ready.title": "Ventamas está listo en este equipo",
  "home.ready.body":
    "Todo lo que registres se guarda en esta computadora y funciona sin internet. Las ventas, los productos y los clientes llegan en las próximas versiones.",
  "home.setup.title": "Dale a Ventamas el nombre y el color de tu tienda",
  "home.setup.body": "Así aparecerá en la pantalla y, más adelante, en tus recibos.",
  "home.setup.action": "Abrir Ajustes",
  "home.setup.done": "Tu tienda ya tiene nombre. Puedes cambiarlo o elegir otro color cuando quieras.",

  "settings.title": "Ajustes",
  "settings.store.title": "Tu tienda",
  "settings.store.name": "Nombre de la tienda",
  "settings.store.name.hint": "Se muestra en la barra lateral. Máximo {max} caracteres.",
  "settings.store.name.placeholder": "Ej.: Calzados Altamira",
  "settings.save": "Guardar",
  "settings.saved": "Guardado",
  "settings.theme.title": "Color",
  "settings.theme.hint": "Elige el color que más se parezca a tu tienda. Se aplica al instante.",
  "settings.theme.dark": "oscuro",
  "settings.about.title": "Acerca de",
  "settings.about.version": "Versión",
  "settings.about.license": "Licencia",
  "settings.about.license.value": "AGPL-3.0 · software libre y de código abierto",
  "settings.about.data": "Tus datos se guardan en",
  "settings.about.openData": "Abrir carpeta",
  "settings.error": "No se pudo guardar. Inténtalo de nuevo.",
} as const;

export type TextKey = keyof typeof es;

export function t(key: TextKey, values?: Record<string, string | number>): string {
  const text: string = es[key];
  if (!values) return text;
  return text.replace(/\{(\w+)\}/g, (match, name: string) => (name in values ? String(values[name]) : match));
}
