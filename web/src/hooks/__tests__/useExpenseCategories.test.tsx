import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/expenses', () => ({
  expensesApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
  expenseCategoriesApi: {
    list: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
  },
}));

import { expenseCategoriesApi } from '@/api/expenses';
import {
  useCreateExpenseCategory,
  useDeleteExpenseCategory,
  useExpenseCategories,
  useUpdateExpenseCategory,
} from '@/hooks/useExpenseCategories';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

const categoryFixture = {
  id: 3,
  name: 'Alquiler',
  created_at: '2026-10-02T10:00:00.000Z',
  expenses_count: 2,
  total: 1200,
};

describe('useExpenseCategories', () => {
  beforeEach(() => {
    vi.mocked(expenseCategoriesApi.list).mockReset();
  });

  it('devuelve las categorías con su nº de gastos y su total', async () => {
    vi.mocked(expenseCategoriesApi.list).mockResolvedValueOnce([categoryFixture]);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useExpenseCategories(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(expenseCategoriesApi.list).toHaveBeenCalledTimes(1);
    expect(result.current.data).toEqual([categoryFixture]);
  });

  it('devuelve error si la consulta falla', async () => {
    vi.mocked(expenseCategoriesApi.list).mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useExpenseCategories(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useCreateExpenseCategory', () => {
  beforeEach(() => {
    vi.mocked(expenseCategoriesApi.create).mockReset();
  });

  it('crea la categoría e invalida categorías, gastos y dashboard', async () => {
    vi.mocked(expenseCategoriesApi.create).mockResolvedValueOnce(categoryFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateExpenseCategory(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Alquiler' });
    });

    expect(expenseCategoriesApi.create).toHaveBeenCalledWith({ name: 'Alquiler' });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expense-categories'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('propaga el error si la creación falla', async () => {
    const boom = new Error('boom');
    vi.mocked(expenseCategoriesApi.create).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useCreateExpenseCategory(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ name: 'Alquiler' })).rejects.toBe(boom);
  });
});

describe('useUpdateExpenseCategory', () => {
  beforeEach(() => {
    vi.mocked(expenseCategoriesApi.update).mockReset();
  });

  it('renombra la categoría e invalida categorías, gastos y dashboard', async () => {
    vi.mocked(expenseCategoriesApi.update).mockResolvedValueOnce(categoryFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateExpenseCategory(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 3, input: { name: 'Renta' } });
    });

    expect(expenseCategoriesApi.update).toHaveBeenCalledWith(3, { name: 'Renta' });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expense-categories'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });
});

describe('useDeleteExpenseCategory', () => {
  beforeEach(() => {
    vi.mocked(expenseCategoriesApi.remove).mockReset();
  });

  it('borra la categoría e invalida categorías, gastos y dashboard', async () => {
    vi.mocked(expenseCategoriesApi.remove).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteExpenseCategory(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(expenseCategoriesApi.remove).toHaveBeenCalledWith(3);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expense-categories'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('propaga el error 409 si la categoría está en uso', async () => {
    const boom = new Error('La categoría tiene gastos asociados');
    vi.mocked(expenseCategoriesApi.remove).mockRejectedValueOnce(boom);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteExpenseCategory(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(3)).rejects.toBe(boom);
    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});
