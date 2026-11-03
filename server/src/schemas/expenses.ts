import { z } from 'zod';
import { EuroMoney, LocalDate, RowId, ShortText } from './common.js';

export const CreateExpenseInput = z
  .object({
    concept: ShortText,
    amount: EuroMoney,
    category_id: RowId,
    expense_date: LocalDate,
  })
  .strict();

export const UpdateExpenseInput = z
  .object({
    concept: ShortText.optional(),
    amount: EuroMoney.optional(),
    category_id: RowId.optional(),
    expense_date: LocalDate.optional(),
  })
  .strict();

export const Expense = z.object({
  id: RowId,
  concept: ShortText,
  amount: EuroMoney,
  category_id: RowId,
  expense_date: LocalDate,
  created_at: z.string(),
});

export const CreateExpenseCategoryInput = z.object({ name: ShortText }).strict();

export const UpdateExpenseCategoryInput = z.object({ name: ShortText.optional() }).strict();

export const ExpenseCategory = z.object({
  id: RowId,
  name: ShortText,
  created_at: z.string(),
});

export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInput>;
export type Expense = z.infer<typeof Expense>;
export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategoryInput>;
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategoryInput>;
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;

export interface ExpenseWithCategory extends Expense {
  category_name: string;
}

export interface ExpenseCategoryWithMetrics extends ExpenseCategory {
  expenses_count: number;
  total_amount: number;
}
