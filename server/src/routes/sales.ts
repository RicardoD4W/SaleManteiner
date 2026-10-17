import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { SalesRepo } from '../repo/sales-repo.js';
import { CreateSaleInput, UpdateSaleInput } from '../schemas/sales.js';

export interface SalesRouterDeps {
  repo: SalesRepo;
}

const IdParam = z.object({
  id: z.coerce.number().int().positive(),
});

const ListQuery = z.object({
  sold: z
    .union([z.literal('true'), z.literal('false')])
    .transform((v) => v === 'true')
    .optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
  offset: z.coerce.number().int().nonnegative().optional(),
});

/**
 * Envuelve handlers async para que los rechazos caigan en `next(err)` y
 * lleguen al middleware de error. Útil como red de seguridad aunque
 * Express 5 propaga async rejections por sí solo.
 */
function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function salesRouter(deps: SalesRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  // IMPORTANTE: `/stats` va antes de `/:id` para que no se confunda con un id.
  router.get(
    '/stats',
    asyncHandler(async (_req, res) => {
      const data = repo.stats();
      res.json({ data });
    }),
  );

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = ListQuery.safeParse(req.query);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Parámetros de búsqueda inválidos',
          issues: parsed.error.flatten(),
        });
      }
      const data = repo.list(parsed.data);
      res.json({ data });
    }),
  );

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Id inválido',
          issues: parsed.error.flatten(),
        });
      }
      const data = repo.getById(parsed.data.id);
      if (!data) {
        return res.status(404).json({ error: 'Venta no encontrada', id: parsed.data.id });
      }
      res.json({ data });
    }),
  );

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateSaleInput.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Datos de venta inválidos',
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
        return res.status(400).json({
          error: 'Id inválido',
          issues: params.error.flatten(),
        });
      }
      const body = UpdateSaleInput.safeParse(req.body);
      if (!body.success) {
        return res.status(400).json({
          error: 'Datos de actualización inválidos',
          issues: body.error.flatten(),
        });
      }
      const data = repo.update(params.data.id, body.data);
      if (!data) {
        return res.status(404).json({ error: 'Venta no encontrada', id: params.data.id });
      }
      res.json({ data });
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Id inválido',
          issues: parsed.error.flatten(),
        });
      }
      const removed = repo.remove(parsed.data.id);
      if (!removed) {
        return res.status(404).json({ error: 'Venta no encontrada', id: parsed.data.id });
      }
      res.status(204).end();
    }),
  );

  return router;
}
