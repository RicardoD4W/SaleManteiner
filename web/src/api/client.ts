export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: { error: string; issues?: unknown },
  ) {
    super(body.error);
    this.name = 'ApiError';
  }
}

export function apiErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) return err.body.error;
  if (err instanceof Error) return err.message;
  return fallback;
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
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
    throw new ApiError(0, { error: 'Error de red' });
  }

  if (!res.ok) {
    const errorBody = await res
      .json()
      .catch(() => ({ error: res.statusText || 'Error desconocido' }));
    throw new ApiError(res.status, errorBody);
  }

  if (res.status === 204) {
    return undefined as T;
  }

  return res.json() as Promise<T>;
}
