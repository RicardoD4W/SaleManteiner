import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { SoldsRepo, StockInsufficientError } from '../repo/solds-repo.js';
import { CreateSoldInput, UpdateSoldInput } from '../schemas/solds.js';

export interface SoldsRouterDeps {
  repo: SoldsRepo;
}

const IdParam = z.object({ id: z.coerce.number().int().positive() });
const ListQuery = z.object({
  customerId: z.coerce.number().int().positive().optional(),
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

export function soldsRouter(deps: SoldsRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

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
      const filters = {
        customerId: parsed.data.customerId,
        ...(parsed.data.from || parsed.data.to
          ? { dateRange: { from: parsed.data.from, to: parsed.data.to } }
          : {}),
      };
      const data = repo.listWithProfit(
        Object.keys(filters).length > 0 ? filters : undefined,
      );
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
      const data = repo.getByIdWithItems(parsed.data.id);
      if (!data) {
        return res.status(404).json({ error: 'Venta no encontrada', id: parsed.data.id });
      }
      res.json({ data });
    }),
  );

  /**
   * POST /api/solds — Creación de venta con validación de stock transaccional (S7).
   * Dentro de db.transaction:
   *   1. Lee stock disponible de cada buy_id.
   *   2. Si alguno no cubre → 422 con detalle del stock insuficiente.
   *   3. Si todos cubren → INSERT solds + INSERTs sale_items.
   */
  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const parsed = CreateSoldInput.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          error: 'Datos de venta inválidos',
          issues: parsed.error.flatten(),
        });
      }

      try {
        const data = repo.createManyWithStockCheck(parsed.data);
        res.status(201).json({ data });
      } catch (err) {
        // El repo lanza StockInsufficientError cuando el stock no cubre.
        // Detectamos por la propiedad discriminada.
        const stockErr = err as Partial<StockInsufficientError> & Error;
        if (stockErr.error === 'Stock insuficiente') {
          return res.status(422).json({
            error: stockErr.error,
            items: stockErr.items,
          });
        }
        throw err; // Rethrow para el error handler global
      }
    }),
  );

  router.patch(
    '/:id',
    asyncHandler(async (req, res) => {
      const params = IdParam.safeParse(req.params);
      if (!params.success) {
        return res.status(400).json({ error: 'Id inválido', issues: params.error.flatten() });
      }
      const body = UpdateSoldInput.safeParse(req.body);
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
        return res.status(400).json({ error: 'Id inválido', issues: parsed.error.flatten() });
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
