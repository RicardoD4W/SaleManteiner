import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseCategoriesApi } from '../api/expenses.js';
import type {
  CreateExpenseCategoryInput,
  UpdateExpenseCategoryInput,
} from '../schemas/expenses.js';
import { invalidate } from '../lib/queryClient';

export function useExpenseCategories() {
  return useQuery({
    queryKey: ['expense-categories'],
    queryFn: expenseCategoriesApi.list,
  });
}

export function useCreateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateExpenseCategoryInput) => expenseCategoriesApi.create(input),
    onSuccess: () => {
      invalidate(qc, ['expense-categories'], ['expenses'], ['stats', 'dashboard']);
    },
  });
}

export function useUpdateExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: number; input: UpdateExpenseCategoryInput }) =>
      expenseCategoriesApi.update(id, input),
    onSuccess: () => {
      invalidate(qc, ['expense-categories'], ['expenses'], ['stats', 'dashboard']);
    },
  });
}

export function useDeleteExpenseCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => expenseCategoriesApi.remove(id),
    onSuccess: () => {
      invalidate(qc, ['expense-categories'], ['expenses'], ['stats', 'dashboard']);
    },
  });
}
