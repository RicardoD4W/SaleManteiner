import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expensesApi } from '../api/expenses.js';
import type { CreateExpenseInput, UpdateExpenseInput } from '../schemas/expenses.js';
import { invalidate } from '../lib/queryClient';

export function useExpenses(categoryId?: number) {
  return useQuery({
    queryKey: ['expenses', categoryId ?? null],
    queryFn: () => expensesApi.list(categoryId),
  });
}

export function useCreateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseInput) => expensesApi.create(input),
    onSuccess: () => {
      invalidate(qc, ['expenses'], ['expense-categories'], ['stats', 'dashboard']);
    },
  });
}

export function useUpdateExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateExpenseInput }) =>
      expensesApi.update(id, input),
    onSuccess: () => {
      invalidate(qc, ['expenses'], ['expense-categories'], ['stats', 'dashboard']);
    },
  });
}

export function useDeleteExpense() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expensesApi.remove(id),
    onSuccess: () => {
      invalidate(qc, ['expenses'], ['expense-categories'], ['stats', 'dashboard']);
    },
  });
}
