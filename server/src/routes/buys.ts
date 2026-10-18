import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { BuysRepo } from '../repo/buys-repo.js';
import { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';

export interface BuysRouterDeps {
  repo: BuysRepo;
}

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const ListQuery = z.object({
  from: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.coerce.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function buysRouter(deps: BuysRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  // `/stock` va antes de `/:id` para que no se confunda con un id numérico.
  router.get(
    '/stock',
    asyncHandler(async (_req, res) => {
      const data = repo.getWithStock();
      res.json({ data });
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = ListQuery.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Parámetros inválidos',
          issues: parsed.error.flatten(),
        });
      }
      const filters = parsed.data.from || parsed.data.to
        ? { dateRange: { from: parsed.data.from, to: parsed.data.to } }
        : undefined;
      const data = repo.list(filters);
      res.json({ data });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const data = repo.getById(parsed.data.id);
      if (!data) {
        return res.status(404).json({ error: 'Compra no encontrada', id: parsed.data.id });
      }
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateBuyInput.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Datos de compra inválidos',
          issues: parsed.error.flatten(),
        });
      }
      const data = repo.create(parsed.data);
      res.status(201).json({ data });
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const params = IdParam.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ error: 'Id inválido', issues: params.error.flatten() });
      }
      const body = UpdateBuyInput.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          error: 'Datos de actualización inválidos',
          issues: body.error.flatten(),
        });
      }
      const data = repo.update(params.data.id, body.data);
      if (!data) {
        return res.status(404).json({ error: 'Compra no encontrada', id: params.data.id });
      }
      res.json({ data });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const removed = repo.remove(parsed.data.id);
      if (!removed) {
        return res.status(404).json({ error: 'Compra no encontrada', id: parsed.data.id });
      }
      res.status(204).end();
    }),
  );

  return router;
}
