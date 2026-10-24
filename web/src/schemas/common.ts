import { z } from 'zod';
import { EuroMoneyField, LocalDateField, LongTextField } from './fields.js';

export const LocalDate = LocalDateField;
export type LocalDate = z.infer<typeof LocalDate>;

export const LongText = LongTextField;

export const EuroMoney = EuroMoneyField;
export type EuroMoney = z.infer<typeof EuroMoney>;

export const RowId = z.number().int().positive();
export type RowId = z.infer<typeof RowId>;
