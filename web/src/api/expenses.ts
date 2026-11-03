import { apiFetch } from './client.js';
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  Expense,
  ExpenseCategory,
  UpdateExpenseCategoryInput,
  UpdateExpenseInput,
} from '../schemas/expenses.js';

interface ListResponse {
  data: Expense[];
}

interface ItemResponse {
  data: Expense;
}

interface CategoryListResponse {
  data: ExpenseCategory[];
}

interface CategoryItemResponse {
  data: ExpenseCategory;
}

export const expensesApi = {
  list: (categoryId?: number) =>
    apiFetch<ListResponse>(
      categoryId === undefined ? '/api/expenses' : `/api/expenses?category_id=${categoryId}`,
    ).then((r) => r.data),

  getById: (id: number) => apiFetch<ItemResponse>(`/api/expenses/${id}`).then((r) => r.data),

  create: (input: CreateExpenseInput) =>
    apiFetch<ItemResponse>('/api/expenses', { method: 'POST', body: input }).then((r) => r.data),

  update: (id: number, input: UpdateExpenseInput) =>
    apiFetch<ItemResponse>(`/api/expenses/${id}`, { method: 'PATCH', body: input }).then(
      (r) => r.data,
    ),

  remove: (id: number) => apiFetch<void>(`/api/expenses/${id}`, { method: 'DELETE' }),
};

export const expenseCategoriesApi = {
  list: () => apiFetch<CategoryListResponse>('/api/expense-categories').then((r) => r.data),

  create: (input: CreateExpenseCategoryInput) =>
    apiFetch<CategoryItemResponse>('/api/expense-categories', { method: 'POST', body: input }).then(
      (r) => r.data,
    ),

  update: (id: number, input: UpdateExpenseCategoryInput) =>
    apiFetch<CategoryItemResponse>(`/api/expense-categories/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((r) => r.data),

  remove: (id: number) => apiFetch<void>(`/api/expense-categories/${id}`, { method: 'DELETE' }),
};
