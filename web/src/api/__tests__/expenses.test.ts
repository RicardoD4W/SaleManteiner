import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { expenseCategoriesApi } from '../expenses.js';

describe('expenseCategoriesApi', () => {
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

  it('mapea el total de la categoría que envía el servidor', async () => {
    mockFetchJson({
      data: [
        {
          id: 1,
          name: 'Alquiler',
          created_at: '2026-10-02T10:00:00.000Z',
          expenses_count: 2,
          total_amount: 1200,
        },
      ],
    });

    const categories = await expenseCategoriesApi.list();

    expect(categories).toEqual([{ id: 1, name: 'Alquiler', expenses_count: 2, total: 1200 }]);
  });

  it('mapea también el total de la categoría recién creada', async () => {
    mockFetchJson({
      data: {
        id: 3,
        name: 'Luz',
        created_at: '2026-10-02T10:00:00.000Z',
        expenses_count: 0,
        total_amount: 0,
      },
    });

    const category = await expenseCategoriesApi.create({ name: 'Luz' });

    expect(category).toEqual({ id: 3, name: 'Luz', expenses_count: 0, total: 0 });
  });
});
