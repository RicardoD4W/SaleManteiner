/**
 * Tests del hook `useCreateSold`. Mockeamos `soldsApi` para no depender del backend.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/solds', () => ({
  soldsApi: {
    list: vi.fn(),
    getById: vi.fn(),
    getByIdWithItems: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

const { toastRegistrado } = vi.hoisted(() => ({ toastRegistrado: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toastRegistrado }));

import { soldsApi } from '@/api/solds';
import { useCreateSold } from '@/hooks/useCreateSold';
import { CreateSoldInput } from '@/schemas/solds';

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

const soldFixture = {
  id: 1,
  customer_id: 1,
  sale_price: 80.0,
  associated_costs: 3.5,
  sold_at: '2026-10-05',
  notes: null,
  created_at: '2026-10-05T10:00:00.000Z',
};

describe('useCreateSold', () => {
  beforeEach(() => {
    vi.mocked(soldsApi.create).mockReset();
  });

  it('llama a soldsApi.create con el input', async () => {
    vi.mocked(soldsApi.create).mockResolvedValueOnce(soldFixture as never);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateSold(), { wrapper: Wrapper });

    const input = CreateSoldInput.parse({
      customer_id: 1,
      sale_price: 80,
      associated_costs: 3.5,
      sold_at: '2026-10-05',
      items: [{ buy_id: 1, quantity: 2 }],
    });
    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(soldsApi.create).toHaveBeenCalledTimes(1);
    expect(soldsApi.create).toHaveBeenCalledWith(input);
  });

  it('en éxito invalida ["solds"] y ["buys"]', async () => {
    vi.mocked(soldsApi.create).mockResolvedValueOnce(soldFixture as never);
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSold(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(
        CreateSoldInput.parse({
          customer_id: 1,
          items: [{ buy_id: 1, quantity: 1 }],
        }),
      );
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['solds'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['buys'] });
      // Con staleTime Infinity, el dashboard solo se refresca si alguien
      // invalida su clave: si no, sus KPIs quedan congelados.
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('en éxito avisa con un toast de venta registrada', async () => {
    vi.mocked(soldsApi.create).mockResolvedValueOnce(soldFixture as never);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateSold(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(
        CreateSoldInput.parse({
          customer_id: 1,
          items: [{ buy_id: 1, quantity: 1 }],
        }),
      );
    });

    await waitFor(() => {
      expect(toastRegistrado).toHaveBeenCalledWith('venta');
    });
  });

  it('propaga el error si soldsApi.create rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(soldsApi.create).mockRejectedValueOnce(boom);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateSold(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync(
        CreateSoldInput.parse({
          customer_id: 1,
          items: [{ buy_id: 1, quantity: 1 }],
        }),
      ),
    ).rejects.toBe(boom);
  });
});
