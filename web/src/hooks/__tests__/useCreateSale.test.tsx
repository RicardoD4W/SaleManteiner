/**
 * Tests del hook `useCreateSale`. Mockeamos `salesApi` para no depender
 * del backend, y usamos `renderHook` para invocar el hook dentro de un
 * QueryClientProvider.
 *
 * Nota: usamos paths relativos en los imports (en lugar del alias `@/`)
 * para que el LSP del editor pueda resolver los tipos sin depender del
 * alias configurado en tsconfig.json. Vitest resuelve via alias sin
 * problema, y los tests no cambian.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../api/sales', () => ({
  salesApi: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    stats: vi.fn(),
  },
}));

import { salesApi } from '../../api/sales';
import { useCreateSale } from '../../hooks/useCreateSale';
import { CreateSaleInput } from '../../schemas/sales';
import { saleFixture } from '../../test-utils/fixtures';

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

describe('useCreateSale', () => {
  beforeEach(() => {
    vi.mocked(salesApi.create).mockReset();
  });

  it('llama a salesApi.create con el input', async () => {
    vi.mocked(salesApi.create).mockResolvedValueOnce(saleFixture);
    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateSale(), { wrapper: Wrapper });

    const input = CreateSaleInput.parse({ product_name: 'X' });
    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(salesApi.create).toHaveBeenCalledTimes(1);
    expect(salesApi.create).toHaveBeenCalledWith(input);
  });

  it('en éxito invalida ["sales"] y ["stats"]', async () => {
    vi.mocked(salesApi.create).mockResolvedValueOnce(saleFixture);
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSale(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(CreateSaleInput.parse({ product_name: 'X' }));
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sales'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats'] });
    });
  });

  it('propaga el error si salesApi.create rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(salesApi.create).mockRejectedValueOnce(boom);

    const { Wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateSale(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync(CreateSaleInput.parse({ product_name: 'X' })),
    ).rejects.toBe(boom);
  });

  it('NO invalida queries si la mutación falla', async () => {
    vi.mocked(salesApi.create).mockRejectedValueOnce(new Error('boom'));
    const { qc, Wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useCreateSale(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync(CreateSaleInput.parse({ product_name: 'X' }));
      } catch {
        // expected
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});