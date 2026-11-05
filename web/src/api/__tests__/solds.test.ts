import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { soldsApi } from '../solds.js';

describe('soldsApi.list', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetchJson(body: unknown) {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    return fetchMock;
  }

  it('sin rango pide la lista entera', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await soldsApi.list();

    expect(fetchMock).toHaveBeenCalledWith('/api/solds', expect.anything());
  });

  it('con rango pide from y to', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await soldsApi.list({ from: '2026-01-01', to: '2026-06-30' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/solds?from=2026-01-01&to=2026-06-30',
      expect.anything(),
    );
  });

  it('con un solo extremo solo manda ese extremo', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await soldsApi.list({ from: '2026-01-01' });

    expect(fetchMock).toHaveBeenCalledWith('/api/solds?from=2026-01-01', expect.anything());
  });
});
