import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/buys', () => ({
  buysApi: {
    list: vi.fn(),
    getById: vi.fn(),
    getStock: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeCascade: vi.fn(),
  },
}));

const { toastDeleted } = vi.hoisted(() => ({ toastDeleted: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toastDeleted }));

import { buysApi } from '@/api/buys';
import { useDeleteBuyCascade } from '@/hooks/useDeleteBuyCascade';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

describe('useDeleteBuyCascade', () => {
  beforeEach(() => {
    vi.mocked(buysApi.removeCascade).mockReset();
    toastDeleted.mockClear();
  });

  it('llama a buysApi.removeCascade con el id', async () => {
    vi.mocked(buysApi.removeCascade).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteBuyCascade(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(buysApi.removeCascade).toHaveBeenCalledTimes(1);
    expect(buysApi.removeCascade).toHaveBeenCalledWith(3);
  });

  it('en éxito invalida compras, ventas, tags, clientes, dashboard, métricas y productos', async () => {
    vi.mocked(buysApi.removeCascade).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteBuyCascade(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['buys'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['solds'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'metrics'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['products'] });
    });
  });

  it('en éxito avisa con un toast de compra eliminada', async () => {
    vi.mocked(buysApi.removeCascade).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteBuyCascade(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      expect(toastDeleted).toHaveBeenCalledWith('buy');
    });
  });

  it('propaga el error si buysApi.removeCascade rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(buysApi.removeCascade).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteBuyCascade(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(3)).rejects.toBe(boom);
  });

  it('NO invalida queries ni avisa si la mutación falla', async () => {
    vi.mocked(buysApi.removeCascade).mockRejectedValueOnce(new Error('boom'));
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteBuyCascade(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync(3);
      } catch {
        return;
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toastDeleted).not.toHaveBeenCalled();
  });
});
