import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/solds', () => ({
  soldsApi: {
    list: vi.fn(),
  },
}));

import { soldsApi } from '@/api/solds';
import { useSolds } from '@/hooks/useSolds';

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

const soldsFixture = [
  {
    id: 1,
    customer_id: 1,
    sale_price: 100,
    associated_costs: 5,
    paid_amount: null,
    sold_at: '2026-10-02',
    notes: null,
    created_at: '2026-10-02T10:00:00.000Z',
    profit: 30,
    items: [],
  },
];

describe('useSolds', () => {
  beforeEach(() => {
    vi.mocked(soldsApi.list).mockReset();
    vi.mocked(soldsApi.list).mockResolvedValue(soldsFixture as never);
  });

  it('sin rango pide la lista entera', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSolds(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(soldsApi.list).toHaveBeenCalledWith(undefined);
  });

  it('manda el rango a la api', async () => {
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useSolds({ from: '2026-01-01', to: '2026-06-30' }), {
      wrapper: Wrapper,
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(soldsApi.list).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-06-30' });
  });

  it('dos rangos distintos son dos consultas distintas', async () => {
    const { Wrapper } = makeWrapper();
    const { rerender } = renderHook(
      ({ range }: { range?: { from?: string; to?: string } }) => useSolds(range),
      { wrapper: Wrapper, initialProps: { range: { from: '2026-01-01' } } },
    );

    await waitFor(() => {
      expect(soldsApi.list).toHaveBeenCalledTimes(1);
    });

    rerender({ range: { from: '2026-02-01' } });

    await waitFor(() => {
      expect(soldsApi.list).toHaveBeenCalledTimes(2);
    });
  });
});
