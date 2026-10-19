import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { logger } from '../logger.js';
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
      const data = repo.listWithStock(filters);
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

  // La ruta cascade se registra antes que `/:id` por claridad de lectura.
  // OJO: en Express 5 el parámetro `:id` NO matchea segmentos con '/'
  // (path-to-regexp v8 usa `[^/]+`), así que '/5/cascade' nunca matchearía
  // `/:id`. El orden NO es lo que protege esta ruta — lo que la protege es
  // que el path tenga dos segmentos. El test de rutas
  // `server/src/__tests__/buys-routes.test.ts` lo verifica por HTTP.
  router.delete(
    '/:id/cascade',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const id = parsed.data.id;
      // Audit trail (S13): la cascada NO tiene undo. Logueamos qué ventas
      // quedan afectadas ANTES de borrarlas (si el borrado falla, no hay
      // log, así que el log solo puede corresponder a un borrado real).
      const affected = repo.listAssociatedSales(id);
      const removed = repo.removeWithCascade(id);
      if (!removed) {
        return res.status(404).json({ error: 'Compra no encontrada', id });
      }
      logger.warn(
        {
          buy_id: id,
          affected_sales: affected.map((s) => ({
            id: s.id,
            customer_name: s.customer_name,
            items_count: s.items_count,
          })),
        },
        'Borrado en cascada de compra con ventas asociadas',
      );
      res.status(204).end();
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
      }
      const result = repo.remove(parsed.data.id);
      if (result.ok) {
        return res.status(204).end();
      }
      if (result.code === 'NOT_FOUND') {
        return res
          .status(404)
          .json({ error: 'Compra no encontrada', id: parsed.data.id });
      }
      // HAS_ASSOCIATED_SALES: 409 con la lista de ventas para que la UI
      // pueda mostrar el modal de confirmación cascade.
      return res.status(409).json({
        error:
          'No se puede borrar: la compra tiene ventas asociadas. ¿Querés borrar también las ventas?',
        associated_sales: result.sales,
      });
    }),
  );

  return router;
}
