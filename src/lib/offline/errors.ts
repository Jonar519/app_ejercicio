/** Error de una llamada a Supabase con el estado HTTP, que el SDK no incluye en el objeto de error. */
export class RemoteError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'RemoteError';
    this.status = status;
  }
}

/**
 * Reintentable: sin red (estado 0), token caducado, límite de peticiones o fallo del servidor.
 * El resto son rechazos del servidor que no cambiarán al repetir.
 */
export const isTransientError = (error: unknown) => {
  if (error instanceof TypeError) return true;
  if (!(error instanceof RemoteError)) return false;
  return (
    error.status === 0 ||
    error.status === 401 ||
    error.status === 408 ||
    error.status === 429 ||
    error.status >= 500
  );
};

/** Cubre también los errores de `throw error` del SDK, que sin red llevan el texto del `fetch`. */
export const isNetworkFailure = (error: unknown) => {
  if (isTransientError(error)) return true;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && /failed to fetch|networkerror|load failed/i.test(message);
};
