/**
 * Tests del hook `useCreateBuy`. Mockeamos `buysApi` para no depender del backend.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/buys', () => ({
  buysApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    getStock: vi.fn(),
  },
}));

import { buysApi } from '@/api/buys';
import { useCreateBuy } from '@/hooks/useCreateBuy';
import { CreateBuyInput } from '@/schemas/buys';

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    qc,
    Wrapper: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={qc}>{children}</QueryClientProvider>
    ),
  };
}

const buyFixture = {
  id: 1,
  product_name: 'Funda iPhone',
  purchase_cost: 50.0,
  quantity: 10,
  associated_costs: 5.0,
  purchase_date: '2026-10-01',
  created_at: '2026-10-01T10:00:00.000Z',
};

describe('useCreateBuy', () => {
  beforeEach(() => {
    vi.mocked(buysApi.create).mockReset();
  });

  it('llama a buysApi.create con el input', async () => {
    vi.mocked(buysApi.create).mockResolvedValueOnce(buyFixture as never);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateBuy(), { wrapper: Wrapper });

    const input = CreateBuyInput.parse({ product_name: 'X' });
    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(buysApi.create).toHaveBeenCalledTimes(1);
    expect(buysApi.create).toHaveBeenCalledWith(input);
  });

  it('en éxito invalida ["buys"]', async () => {
    vi.mocked(buysApi.create).mockResolvedValueOnce(buyFixture as never);
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateBuy(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(CreateBuyInput.parse({ product_name: 'X' }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['buys'] });
    });
  });

  it('propaga el error si buysApi.create rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(buysApi.create).mockRejectedValueOnce(boom);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateBuy(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync(CreateBuyInput.parse({ product_name: 'X' })),
    ).rejects.toBe(boom);
  });

  it('NO invalida queries si la mutación falla', async () => {
    vi.mocked(buysApi.create).mockRejectedValueOnce(new Error('boom'));
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateBuy(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync(CreateBuyInput.parse({ product_name: 'X' }));
      } catch {
        // expected
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
