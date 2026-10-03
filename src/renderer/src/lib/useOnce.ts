import { useCallback, useRef } from "react";

/**
 * Evita que una operación se lance dos veces por un doble clic: mientras la primera no
 * termina, las siguientes se ignoran. Un botón desactivado no basta, porque el segundo
 * clic puede llegar antes de que la pantalla se vuelva a pintar.
 */
export function useOnce(): (action: () => Promise<void>) => Promise<void> {
  const running = useRef(false);
  return useCallback(async (action) => {
    if (running.current) return;
    running.current = true;
    try {
      await action();
    } finally {
      running.current = false;
    }
  }, []);
}
