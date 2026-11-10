import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/tags', () => ({
  listTags: vi.fn(),
  createTag: vi.fn(),
  updateTag: vi.fn(),
  deleteTag: vi.fn(),
}));

const { toastCreated, toastUpdated, toastDeleted } = vi.hoisted(() => ({
  toastCreated: vi.fn(),
  toastUpdated: vi.fn(),
  toastDeleted: vi.fn(),
}));
vi.mock('@/lib/toast', () => ({ toastCreated, toastUpdated, toastDeleted }));

import { createTag, deleteTag, listTags, updateTag, type ApiTag } from '@/api/tags';
import { useCreateTag, useDeleteTag, useTags, useUpdateTag } from '@/hooks/useTags';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

const tagFixture: ApiTag = {
  id: 1,
  scope: 'buy',
  name: 'Oferta',
  color: '#ff8800',
  created_at: '2026-11-01T10:00:00.000Z',
};

const tagWithCount = { ...tagFixture, buy_count: 3 };

describe('useTags', () => {
  beforeEach(() => {
    vi.mocked(listTags).mockReset();
  });

  it('pide el catálogo del ámbito que recibe', async () => {
    vi.mocked(listTags).mockResolvedValueOnce([tagWithCount]);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useTags('buy'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(listTags).toHaveBeenCalledWith('buy');
    expect(result.current.data).toEqual([tagWithCount]);
  });

  it('pide el catálogo de ventas cuando el ámbito es sold', async () => {
    vi.mocked(listTags).mockResolvedValueOnce([]);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useTags('sold'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(listTags).toHaveBeenCalledWith('sold');
  });

  it('devuelve error si la consulta falla', async () => {
    vi.mocked(listTags).mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useTags('buy'), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useCreateTag', () => {
  beforeEach(() => {
    vi.mocked(createTag).mockReset();
    toastCreated.mockClear();
  });

  it('crea el tag en el ámbito e invalida el catálogo y las compras', async () => {
    vi.mocked(createTag).mockResolvedValueOnce(tagFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTag('buy'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Oferta', color: '#ff8800' });
    });

    expect(createTag).toHaveBeenCalledWith('buy', { name: 'Oferta', color: '#ff8800' });
    expect(toastCreated).toHaveBeenCalledWith('tag', 'Oferta');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags', 'buy'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['buys'] });
    });
  });

  it('propaga el error si la creación falla', async () => {
    const boom = new Error('Ya existe un tag con ese nombre');
    vi.mocked(createTag).mockRejectedValueOnce(boom);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateTag('buy'), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ name: 'Oferta', color: '#ff8800' })).rejects.toBe(
      boom,
    );
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('useUpdateTag', () => {
  beforeEach(() => {
    vi.mocked(updateTag).mockReset();
    toastUpdated.mockClear();
  });

  it('actualiza el tag en el ámbito e invalida el catálogo y las compras', async () => {
    vi.mocked(updateTag).mockResolvedValueOnce(tagFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateTag('buy'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, input: { name: 'Promo' } });
    });

    expect(updateTag).toHaveBeenCalledWith('buy', 1, { name: 'Promo' });
    expect(toastUpdated).toHaveBeenCalledWith('tag', 'Promo');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags', 'buy'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['buys'] });
    });
  });
});

describe('useDeleteTag', () => {
  beforeEach(() => {
    vi.mocked(deleteTag).mockReset();
    toastDeleted.mockClear();
  });

  it('borra el tag del ámbito e invalida el catálogo y las compras', async () => {
    vi.mocked(deleteTag).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteTag('buy'), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(1);
    });

    expect(deleteTag).toHaveBeenCalledWith('buy', 1);
    expect(toastDeleted).toHaveBeenCalledWith('tag');

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['tags', 'buy'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['buys'] });
    });
  });

  it('propaga el error si el borrado falla', async () => {
    const boom = new Error('El tag no existe');
    vi.mocked(deleteTag).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteTag('buy'), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(1)).rejects.toBe(boom);
  });
});
