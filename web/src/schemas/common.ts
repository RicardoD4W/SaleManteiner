import { z } from 'zod';

export const ISODateTime = z.string().datetime({ offset: true });
export type ISODateTime = z.infer<typeof ISODateTime>;

export const LocalDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha inválida (YYYY-MM-DD)');
export type LocalDate = z.infer<typeof LocalDate>;

export const ShortText = z.string().min(1).max(200);

export const LongText = z.string().max(5000);

export const EuroMoney = z.number().nonnegative().multipleOf(0.01);
export type EuroMoney = z.infer<typeof EuroMoney>;

export const RowId = z.number().int().positive();
export type RowId = z.infer<typeof RowId>;
