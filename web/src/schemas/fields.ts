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

function shortText(requiredMessage: string) {
  return z
    .string()
    .min(1, requiredMessage)
    .max(200, 'Máximo 200 caracteres')
    .refine((value) => value.trim().length > 0, requiredMessage);
}

export const ProductNameField = shortText('El producto es obligatorio');

export const CustomerNameField = shortText('El nombre es obligatorio');

export const EuroMoneyField = z
  .number({ error: 'Introduce un número' })
  .nonnegative('No puede ser negativo')
  .multipleOf(0.01, 'Máximo 2 decimales');

export const QuantityField = z
  .number({ error: 'Introduce un número' })
  .int('La cantidad debe ser un número entero')
  .min(1, 'La cantidad mínima es 1');

export const CustomerIdField = z
  .number({ error: 'El cliente es obligatorio' })
  .int('El cliente es obligatorio')
  .positive('El cliente es obligatorio');

export const LocalDateField = z
  .string()
  .regex(DATE_PATTERN, 'Fecha inválida (YYYY-MM-DD)')
  .refine(isValidLocalDate, 'Fecha inválida (YYYY-MM-DD)');

export const FormDateField = z
  .string()
  .refine((value) => value === '' || isValidLocalDate(value), 'Fecha inválida (YYYY-MM-DD)')
  .optional();

export const LongTextField = z.string().max(5000, 'Máximo 5000 caracteres');

export const NotesField = LongTextField.optional();
