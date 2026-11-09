import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/buys', () => ({
  buysApi: {
    list: vi.fn(),
  },
}));

import { buysApi } from '@/api/buys';
import { useBuys } from '@/hooks/useBuys';
import type { BuyWithStock } from '@/api/buys';

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

const buysFixture: BuyWithStock[] = [
  {
    id: 1,
    product_name: 'Funda iPhone 15',
    purchase_cost: 45.5,
    quantity: 20,
    total_cost: 910,
    associated_costs: 3.2,
    purchase_date: '2026-10-02',
    notes: null,
    tag: null,
    created_at: '2026-10-02T10:00:00.000Z',
    disponibles: 17,
  },
];

describe('useBuys', () => {
  beforeEach(() => {
    vi.mocked(buysApi.list).mockReset();
    vi.mocked(buysApi.list).mockResolvedValue(buysFixture as never);
  });

  it('sin rango pide la lista entera', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBuys(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(buysApi.list).toHaveBeenCalledWith(undefined, undefined);
  });

  it('manda el filtro de tags a la api', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBuys(undefined, { tagIds: [3, 7], sinTag: false }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(buysApi.list).toHaveBeenCalledWith(undefined, { tagIds: [3, 7], sinTag: false });
  });

  it('un filtro de tags distinto es otra consulta', async () => {
    const { Wrapper } = makeWrapper();
    const { rerender } = renderHook(
      ({ filter }: { filter?: { tagIds?: number[] } }) => useBuys(undefined, filter),
      { wrapper: Wrapper, initialProps: { filter: { tagIds: [3] } } },
    );

    await waitFor(() => {
      expect(buysApi.list).toHaveBeenCalledTimes(1);
    });

    rerender({ filter: { tagIds: [7] } });

    await waitFor(() => {
      expect(buysApi.list).toHaveBeenCalledTimes(2);
    });
  });

  it('manda el rango a la api', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useBuys({ from: '2026-01-01', to: '2026-06-30' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(buysApi.list).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-06-30' }, undefined);
  });

  it('dos rangos distintos son dos consultas distintas', async () => {
    const { Wrapper } = makeWrapper();
    const { rerender } = renderHook(
      ({ range }: { range?: { from?: string; to?: string } }) => useBuys(range),
      { wrapper: Wrapper, initialProps: { range: { from: '2026-01-01' } } },
    );

    await waitFor(() => {
      expect(buysApi.list).toHaveBeenCalledTimes(1);
    });

    rerender({ range: { from: '2026-02-01' } });

    await waitFor(() => {
      expect(buysApi.list).toHaveBeenCalledTimes(2);
    });
  });

  it('el mismo rango no vuelve a pedir los datos', async () => {
    const { Wrapper } = makeWrapper();
    const { rerender } = renderHook(
      ({ range }: { range?: { from?: string; to?: string } }) => useBuys(range),
      { wrapper: Wrapper, initialProps: { range: { from: '2026-01-01' } } },
    );

    await waitFor(() => {
      expect(buysApi.list).toHaveBeenCalledTimes(1);
    });

    rerender({ range: { from: '2026-01-01' } });

    await waitFor(() => {
      expect(buysApi.list).toHaveBeenCalledTimes(1);
    });
  });
});
