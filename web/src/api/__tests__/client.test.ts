/**
 * Tests del cliente HTTP. Mockeamos `fetch` global para no depender de la red
 * ni del backend.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from '../client.js';

describe('apiFetch', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  /** Mockea fetch con una respuesta JSON. Para 204 usar `mockFetchNoContent` (Response no permite body con status 204). */
  function mockFetchJson(body: unknown, status = 200) {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    return fetchMock;
  }

  /** Mockea fetch con 204 No Content. */
  function mockFetchNoContent() {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));
    return fetchMock;
  }

  it('envía Content-Type y Accept JSON por defecto', async () => {
    mockFetchJson({ data: { ok: true } });
    await apiFetch('/api/health');

    const fetchMock = vi.mocked(fetch);
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Accept: 'application/json',
        }),
      }),
    );
  });

  it('serializa el body a JSON cuando se pasa', async () => {
    mockFetchJson({ data: { id: 1 } });
    await apiFetch('/api/sales', {
      method: 'POST',
      body: { product_name: 'X' },
    });

    const fetchMock = vi.mocked(fetch);
    const callArgs = fetchMock.mock.calls[0];
    expect(callArgs?.[1]?.body).toBe(JSON.stringify({ product_name: 'X' }));
    expect(callArgs?.[1]?.method).toBe('POST');
  });

  it('NO serializa body si es undefined', async () => {
    mockFetchJson({ data: [] });
    await apiFetch('/api/sales');
    const fetchMock = vi.mocked(fetch);
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBeUndefined();
  });

  it('devuelve el body parseado en éxito', async () => {
    const payload = { data: [{ id: 1, product_name: 'X' }] };
    mockFetchJson(payload);
    const result = await apiFetch<typeof payload>('/api/sales');
    expect(result).toEqual(payload);
  });

  it('tira ApiError con body estructurado en 400', async () => {
    mockFetchJson(
      { error: 'Datos inválidos', issues: [{ path: 'product_name', message: 'obligatorio' }] },
      400,
    );

    let caught: unknown;
    try {
      await apiFetch('/api/sales', { method: 'POST', body: {} });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiErr = caught as ApiError;
    expect(apiErr.status).toBe(400);
    expect(apiErr.body.error).toBe('Datos inválidos');
    expect(apiErr.body.issues).toHaveLength(1);
    expect(apiErr.message).toBe('Datos inválidos');
  });

  it('tira ApiError en 500 con mensaje en español', async () => {
    mockFetchJson({ error: 'Error interno del servidor' }, 500);

    let caught: unknown;
    try {
      await apiFetch('/api/sales');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiErr = caught as ApiError;
    expect(apiErr.status).toBe(500);
    expect(apiErr.body.error).toBe('Error interno del servidor');
  });

  it('envuelve TypeError de fetch en ApiError con mensaje "Error de red"', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'));

    let caught: unknown;
    try {
      await apiFetch('/api/sales');
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(ApiError);
    const apiErr = caught as ApiError;
    expect(apiErr.status).toBe(0);
    expect(apiErr.body.error).toBe('Error de red');
  });

  it('devuelve undefined cuando el backend responde 204', async () => {
    mockFetchNoContent();
    const result = await apiFetch<void>('/api/sales/1', { method: 'DELETE' });
    expect(result).toBeUndefined();
  });
});