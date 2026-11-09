import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buysApi } from '../buys.js';

describe('buysApi', () => {
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

    await buysApi.list();

    expect(fetchMock).toHaveBeenCalledWith('/api/buys', expect.anything());
  });

  it('con rango pide from y to', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await buysApi.list({ from: '2026-01-01', to: '2026-06-30' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/buys?from=2026-01-01&to=2026-06-30',
      expect.anything(),
    );
  });

  it('con un solo extremo solo manda ese extremo', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await buysApi.list({ to: '2026-06-30' });

    expect(fetchMock).toHaveBeenCalledWith('/api/buys?to=2026-06-30', expect.anything());
  });

  it('con filtro de tags manda los ids en csv', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await buysApi.list(undefined, { tagIds: [3, 7] });

    expect(fetchMock).toHaveBeenCalledWith('/api/buys?tag_ids=3%2C7', expect.anything());
  });

  it('con filtro sin tag lo pide como parámetro excluyente', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await buysApi.list(undefined, { sinTag: true });

    expect(fetchMock).toHaveBeenCalledWith('/api/buys?sin_tag=true', expect.anything());
  });

  it('combina rango de fechas y filtro de tags', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await buysApi.list({ from: '2026-01-01', to: '2026-06-30' }, { tagIds: [3] });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/buys?from=2026-01-01&to=2026-06-30&tag_ids=3',
      expect.anything(),
    );
  });

  it('sin filtro de tags no manda parámetros de tag', async () => {
    const fetchMock = mockFetchJson({ data: [] });

    await buysApi.list(undefined, { tagIds: [], sinTag: false });

    expect(fetchMock).toHaveBeenCalledWith('/api/buys', expect.anything());
  });
});
