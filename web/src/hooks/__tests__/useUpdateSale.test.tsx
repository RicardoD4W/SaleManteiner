/**
 * Tests del hook `useUpdateSale`. Mockeamos `salesApi`.
 *
 * Nota: usamos monkey-patch en lugar de `vi.spyOn(qc, ...)` para espiar
 * los métodos del QueryClient. TanStack Query expone métodos en el prototype
 * y `vi.spyOn` a veces no los intercepta correctamente con QueryClient v5.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/sales', () => ({
  salesApi: {
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    list: vi.fn(),
    getById: vi.fn(),
    stats: vi.fn(),
  },
}));

import { salesApi } from '@/api/sales';
import { useUpdateSale } from '@/hooks/useUpdateSale';
import { UpdateSaleInput } from '@/schemas/sales';
import { saleFixture } from '@/test-utils/fixtures';
import { Sale } from '@/schemas/sales';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

describe('useUpdateSale', () => {
  beforeEach(() => {
    vi.mocked(salesApi.update).mockReset();
  });

  it('llama a salesApi.update con { id, input }', async () => {
    vi.mocked(salesApi.update).mockResolvedValueOnce(saleFixture);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useUpdateSale(), { wrapper: Wrapper });

    const input = UpdateSaleInput.parse({ price_cents: 30000, sold: true });
    await act(async () => {
      await result.current.mutateAsync({ id: 7, input });
    });

    expect(salesApi.update).toHaveBeenCalledTimes(1);
    expect(salesApi.update).toHaveBeenCalledWith(7, input);
  });

  it('en éxito invalida ["sales"] y ["stats"]', async () => {
    vi.mocked(salesApi.update).mockResolvedValueOnce(saleFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateSale(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 7,
        input: UpdateSaleInput.parse({ price_cents: 30000 }),
      });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sales'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats'] });
    });
  });

  it('en éxito setea queryData ["sales", id] con la respuesta (verificable via getQueryData)', async () => {
    // El hook llama a setQueryData(['sales', data.id], data) — la respuesta
    // debe tener id=7 para que matchee.
    const updatedSale = Sale.parse({ ...saleFixture, id: 7, price_cents: 30000 });
    vi.mocked(salesApi.update).mockResolvedValueOnce(updatedSale);
    const { qc, Wrapper } = makeHookWrapper();

    const { result } = renderHook(() => useUpdateSale(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        id: 7,
        input: UpdateSaleInput.parse({ price_cents: 30000 }),
      });
    });

    // Verificar el efecto (cache poblada) en lugar de espiar la llamada.
    expect(qc.getQueryData(['sales', 7])).toEqual(updatedSale);
  });

  it('propaga el error si salesApi.update rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(salesApi.update).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useUpdateSale(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        id: 7,
        input: UpdateSaleInput.parse({ price_cents: 30000 }),
      }),
    ).rejects.toBe(boom);
  });
});