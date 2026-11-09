import type { NextFunction, Request, Response } from 'express';
import { z } from 'zod';

export const IdParam = z.object({ id: z.coerce.number().int().positive() });

export const DateRangeQuery = z.object({
  from: z.coerce
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  to: z.coerce
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

export const SalesListQuery = DateRangeQuery.extend({
  customerId: z.coerce.number().int().positive().optional(),
});

export const BuysListQuery = DateRangeQuery.extend({
  tag_ids: z.string().optional(),
  sin_tag: z.enum(['true', 'false']).optional(),
});

export const CustomersSearchQuery = z.object({ name: z.string().min(1).optional() }).strict();

export const ExpensesListQuery = z
  .object({
    category_id: z.coerce.number().int().positive().optional(),
  })
  .strict();

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function respondBadRequest(res: Response, error: string, issues: unknown): Response {
  return res.status(400).json({ error, issues });
}

export function parseTagIdsParam(raw: string | undefined): number[] | null {
  if (raw === undefined) return [];
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const ids = parts.map((part) => Number(part));
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return null;
  return ids;
}
