/**
 * Tests del hook `useDeleteSale`. Mockeamos `salesApi`.
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
import { useDeleteSale } from '@/hooks/useDeleteSale';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

describe('useDeleteSale', () => {
  beforeEach(() => {
    vi.mocked(salesApi.remove).mockReset();
  });

  it('llama a salesApi.remove con el id', async () => {
    vi.mocked(salesApi.remove).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteSale(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(salesApi.remove).toHaveBeenCalledTimes(1);
    expect(salesApi.remove).toHaveBeenCalledWith(3);
  });

  it('en éxito invalida ["sales"] y ["stats"]', async () => {
    vi.mocked(salesApi.remove).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteSale(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['sales'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats'] });
    });
  });

  it('NO invalida ["sales", id] (eso solo lo hace useUpdate)', async () => {
    vi.mocked(salesApi.remove).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteSale(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(invalidateSpy).not.toHaveBeenCalledWith({ queryKey: ['sales', 3] });
  });

  it('propaga el error si salesApi.remove rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(salesApi.remove).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteSale(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(3)).rejects.toBe(boom);
  });
});