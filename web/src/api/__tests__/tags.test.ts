import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createTag,
  deleteTag,
  listTags,
  updateTag,
  type ApiTag,
  type ApiTagWithCount,
} from '../tags.js';

const tagFixture: ApiTag = {
  id: 1,
  scope: 'buy',
  name: 'Oferta',
  color: '#ff8800',
  created_at: '2026-11-01T10:00:00.000Z',
};

const tagWithCount: ApiTagWithCount = { ...tagFixture, buy_count: 3 };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('listTags', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('pide el catálogo del ámbito buy', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [tagWithCount] }));

    const tags = await listTags('buy');

    expect(fetchMock).toHaveBeenCalledWith('/api/tags/buy', expect.anything());
    expect(tags).toEqual([tagWithCount]);
  });

  it('pide el catálogo del ámbito sold en su propia ruta', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

    await listTags('sold');

    expect(fetchMock).toHaveBeenCalledWith('/api/tags/sold', expect.anything());
  });
});

describe('createTag', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('crea el tag en el ámbito con nombre y color', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: tagFixture }, 201));

    const tag = await createTag('buy', { name: 'Oferta', color: '#ff8800' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tags/buy',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'Oferta', color: '#ff8800' }),
      }),
    );
    expect(tag).toEqual(tagFixture);
  });

  it('propaga el 409 de nombre duplicado', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'Ya existe un tag con ese nombre' }, 409),
    );

    await expect(createTag('buy', { name: 'Oferta', color: '#ff8800' })).rejects.toThrow(
      'Ya existe un tag con ese nombre',
    );
  });
});

describe('updateTag', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('actualiza el tag con su id en el ámbito', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: tagFixture }));

    const tag = await updateTag('buy', 7, { name: 'Promo', color: '#00ff00' });

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tags/buy/7',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ name: 'Promo', color: '#00ff00' }),
      }),
    );
    expect(tag).toEqual(tagFixture);
  });

  it('propaga el 404 de tag inexistente', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'El tag no existe' }, 404));

    await expect(updateTag('buy', 99, { name: 'Promo' })).rejects.toThrow('El tag no existe');
  });
});

describe('deleteTag', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('borra el tag y no devuelve cuerpo', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 204 }));

    const result = await deleteTag('buy', 7);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/tags/buy/7',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(result).toBeUndefined();
  });

  it('propaga el 404 de tag inexistente', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'El tag no existe' }, 404));

    await expect(deleteTag('buy', 99)).rejects.toThrow('El tag no existe');
  });
});
