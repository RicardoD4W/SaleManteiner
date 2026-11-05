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

import { expensesApi } from '@/api/expenses';
import {
  useCreateExpense,
  useDeleteExpense,
  useExpenses,
  useUpdateExpense,
} from '@/hooks/useExpenses';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

const expenseFixture = {
  id: 1,
  concept: 'Alquiler del local',
  amount: 1200,
  category_id: 3,
  expense_date: '2026-10-02',
  created_at: '2026-10-02T10:00:00.000Z',
};

describe('useExpenses', () => {
  beforeEach(() => {
    vi.mocked(expensesApi.list).mockReset();
  });

  it('pide todos los gastos cuando no hay filtro', async () => {
    vi.mocked(expensesApi.list).mockResolvedValueOnce([expenseFixture]);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useExpenses(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(expensesApi.list).toHaveBeenCalledTimes(1);
    expect(expensesApi.list).toHaveBeenCalledWith(undefined);
    expect(result.current.data).toEqual([expenseFixture]);
  });

  it('pide solo los gastos de la categoría filtrada', async () => {
    vi.mocked(expensesApi.list).mockResolvedValueOnce([expenseFixture]);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useExpenses(3), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(expensesApi.list).toHaveBeenCalledWith(3);
  });

  it('devuelve error si la consulta falla', async () => {
    vi.mocked(expensesApi.list).mockRejectedValueOnce(new Error('boom'));
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useExpenses(), { wrapper: Wrapper });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeInstanceOf(Error);
  });
});

describe('useCreateExpense', () => {
  beforeEach(() => {
    vi.mocked(expensesApi.create).mockReset();
  });

  it('crea el gasto y invalida los gastos y el dashboard', async () => {
    vi.mocked(expensesApi.create).mockResolvedValueOnce(expenseFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateExpense(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({
        concept: 'Alquiler del local',
        amount: 1200,
        category_id: 3,
        expense_date: '2026-10-02',
      });
    });

    expect(expensesApi.create).toHaveBeenCalledWith({
      concept: 'Alquiler del local',
      amount: 1200,
      category_id: 3,
      expense_date: '2026-10-02',
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expense-categories'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('propaga el error y no invalida si la creación falla', async () => {
    const boom = new Error('boom');
    vi.mocked(expensesApi.create).mockRejectedValueOnce(boom);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useCreateExpense(), { wrapper: Wrapper });

    await expect(
      result.current.mutateAsync({
        concept: 'Alquiler del local',
        amount: 1200,
        category_id: 3,
        expense_date: '2026-10-02',
      }),
    ).rejects.toBe(boom);

    expect(invalidateSpy).not.toHaveBeenCalled();
  });
});

describe('useUpdateExpense', () => {
  beforeEach(() => {
    vi.mocked(expensesApi.update).mockReset();
  });

  it('actualiza el gasto con su id y invalida los gastos y el dashboard', async () => {
    vi.mocked(expensesApi.update).mockResolvedValueOnce(expenseFixture);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateExpense(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 7, input: { amount: 30 } });
    });

    expect(expensesApi.update).toHaveBeenCalledWith(7, { amount: 30 });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expense-categories'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });
});

describe('useDeleteExpense', () => {
  beforeEach(() => {
    vi.mocked(expensesApi.remove).mockReset();
  });

  it('borra el gasto y invalida los gastos y el dashboard', async () => {
    vi.mocked(expensesApi.remove).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteExpense(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(7);
    });

    expect(expensesApi.remove).toHaveBeenCalledWith(7);

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expenses'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['expense-categories'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('propaga el error si el borrado falla', async () => {
    const boom = new Error('boom');
    vi.mocked(expensesApi.remove).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteExpense(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(7)).rejects.toBe(boom);
  });
});
