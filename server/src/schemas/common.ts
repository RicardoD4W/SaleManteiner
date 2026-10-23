import { z } from 'zod';

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function isValidLocalDate(value: string): boolean {
  const match = DATE_PATTERN.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (month < 1 || month > 12) return false;
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day >= 1 && day <= daysInMonth[month - 1];
}

export const LocalDate = z
  .string()
  .regex(DATE_PATTERN, 'Fecha inválida (YYYY-MM-DD)')
  .refine(isValidLocalDate, 'Fecha inválida (YYYY-MM-DD)');
export type LocalDate = z.infer<typeof LocalDate>;

export const ShortText = z
  .string()
  .min(1)
  .max(200)
  .refine((value) => value.trim().length > 0, 'El texto no puede estar vacío');

export const LongText = z.string().max(5000);

export const EuroMoney = z.number().nonnegative().multipleOf(0.01);
export type EuroMoney = z.infer<typeof EuroMoney>;

export const RowId = z.number().int().positive();
export type RowId = z.infer<typeof RowId>;

export const Quantity = z.number().int().min(1);
