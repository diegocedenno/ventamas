/**
 * Llama a una operación del proceso principal por su canal. Si la operación falla,
 * lanza un Error cuyo mensaje ya está escrito para mostrarlo a la persona.
 */
export async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const result = await window.ventamas.invoke(channel, ...args);
  if (!result.ok) throw new Error(result.error);
  return result.value as T;
}

export function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
