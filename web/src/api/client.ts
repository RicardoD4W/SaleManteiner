/**
 * Wrapper de fetch con manejo de errores estructurados.
 * La API responde con `{ data: ... }` en éxito o `{ error, issues? }` en error.
 */

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { error: string; issues?: unknown },
  ) {
    super(body.error);
    this.name = 'ApiError';
  }
}

export interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const { body, headers, ...rest } = options;

  let res: Response;
  try {
    res = await fetch(path, {
      ...rest,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    // fetch rechaza con TypeError en errores de red (sin conexión, CORS, DNS).
    // Los envolvemos en ApiError para que los consumidores tengan un único
    // tipo de error que manejar y un mensaje en español.
    throw new ApiError(0, { error: 'Error de red' });
  }

  if (!res.ok) {
    const errorBody = await res
      .json()
      .catch(() => ({ error: res.statusText || 'Error desconocido' }));
    throw new ApiError(res.status, errorBody);
  }

  // 204 No Content
  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
