import { z } from 'zod';
import { EuroMoney, LocalDate, RowId } from './common.js';

const ConceptField = z
  .string()
  .min(1, 'El concepto es obligatorio')
  .max(200, 'Máximo 200 caracteres')
  .refine((value) => value.trim().length > 0, 'El concepto es obligatorio');

const CategoryNameField = z
  .string()
  .min(1, 'El nombre es obligatorio')
  .max(200, 'Máximo 200 caracteres')
  .refine((value) => value.trim().length > 0, 'El nombre es obligatorio');

export const Expense = z.object({
  id: RowId,
  concept: ConceptField,
  amount: EuroMoney,
  category_id: RowId,
  expense_date: LocalDate,
  created_at: z.string(),
});

export const ExpenseCategory = z.object({
  id: RowId,
  name: CategoryNameField,
  expenses_count: z.number().int().nonnegative(),
  total: EuroMoney,
});

export const CreateExpenseInput = z
  .object({
    concept: ConceptField,
    amount: EuroMoney,
    category_id: RowId,
    expense_date: LocalDate,
  })
  .strict();

export const UpdateExpenseInput = z
  .object({
    concept: ConceptField.optional(),
    amount: EuroMoney.optional(),
    category_id: RowId.optional(),
    expense_date: LocalDate.optional(),
  })
  .strict();

export const CreateExpenseCategoryInput = z.object({ name: CategoryNameField }).strict();

export const UpdateExpenseCategoryInput = z.object({ name: CategoryNameField.optional() }).strict();

export const ExpenseFormSchema = z.object({
  concept: ConceptField,
  amount: EuroMoney,
  expense_date: LocalDate,
  category_id: z
    .number({ error: 'Elige una categoría' })
    .int('Elige una categoría')
    .positive('Elige una categoría'),
});

export type Expense = z.infer<typeof Expense>;
export type ExpenseCategory = z.infer<typeof ExpenseCategory>;
export type CreateExpenseInput = z.infer<typeof CreateExpenseInput>;
export type UpdateExpenseInput = z.infer<typeof UpdateExpenseInput>;
export type CreateExpenseCategoryInput = z.infer<typeof CreateExpenseCategoryInput>;
export type UpdateExpenseCategoryInput = z.infer<typeof UpdateExpenseCategoryInput>;
export type ExpenseFormInput = z.input<typeof ExpenseFormSchema>;
export type ExpenseFormOutput = z.output<typeof ExpenseFormSchema>;
