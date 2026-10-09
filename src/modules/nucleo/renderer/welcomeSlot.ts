/** Lugar del asistente de bienvenida donde otros módulos añaden su paso. */
export const WELCOME_SLOT = "nucleo.welcome";

/** Lo que recibe el paso que un módulo añade al asistente de bienvenida. */
export interface WelcomeStepProps {
  /**
   * Registra lo que hay que guardar cuando la persona pulsa Continuar en este paso. Si
   * falla, el asistente muestra el error y no avanza.
   */
  onCommit(handler: () => Promise<void>): void;
}
