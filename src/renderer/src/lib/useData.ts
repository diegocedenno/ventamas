import { useCallback, useEffect, useRef, useState, type DependencyList } from "react";
import { messageOf } from "./ipc";

export interface Data<T> {
  /** undefined mientras carga por primera vez. */
  data: T | undefined;
  error: string | null;
  loading: boolean;
  /** Vuelve a pedir los datos. */
  reload(): Promise<void>;
  /** Reemplaza los datos con una respuesta que ya se tiene. */
  set(value: T): void;
}

/** Carga datos del proceso principal al montar y cada vez que cambian las dependencias. */
export function useData<T>(load: () => Promise<T>, deps: DependencyList): Data<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Solo cuenta la respuesta de la petición más reciente.
  const latest = useRef(0);
  const loader = useRef(load);
  loader.current = load;

  const reload = useCallback(async () => {
    const ticket = ++latest.current;
    setLoading(true);
    try {
      const value = await loader.current();
      if (ticket !== latest.current) return;
      setData(value);
      setError(null);
    } catch (reason) {
      if (ticket !== latest.current) return;
      setError(messageOf(reason));
    } finally {
      if (ticket === latest.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const set = useCallback((value: T) => {
    latest.current++;
    setData(value);
    setError(null);
    setLoading(false);
  }, []);

  return { data, error, loading, reload, set };
}
