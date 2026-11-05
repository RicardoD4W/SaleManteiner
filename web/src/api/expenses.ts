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

export interface ApiExpenseCategory {
  id: number;
  name: string;
  created_at: string;
}

export interface ApiExpenseCategoryWithMetrics extends ApiExpenseCategory {
  expenses_count: number;
  total_amount: number;
}

interface CategoryListResponse {
  data: ApiExpenseCategoryWithMetrics[];
}

interface CategoryItemResponse {
  data: ApiExpenseCategoryWithMetrics;
}

interface CategoryPlainItemResponse {
  data: ApiExpenseCategory;
}

function toExpenseCategory(raw: ApiExpenseCategoryWithMetrics): ExpenseCategory {
  return {
    id: raw.id,
    name: raw.name,
    expenses_count: raw.expenses_count,
    total: raw.total_amount,
  };
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
  list: () =>
    apiFetch<CategoryListResponse>('/api/expense-categories').then((r) =>
      r.data.map(toExpenseCategory),
    ),

  create: (input: CreateExpenseCategoryInput) =>
    apiFetch<CategoryItemResponse>('/api/expense-categories', { method: 'POST', body: input }).then(
      (r) => toExpenseCategory(r.data),
    ),

  update: (id: number, input: UpdateExpenseCategoryInput) =>
    apiFetch<CategoryPlainItemResponse>(`/api/expense-categories/${id}`, {
      method: 'PATCH',
      body: input,
    }).then((r) => r.data),

  remove: (id: number) => apiFetch<void>(`/api/expense-categories/${id}`, { method: 'DELETE' }),
};
