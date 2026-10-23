import { Router } from 'express';
import { logger } from '../logger.js';
import type { BuysRepo } from '../repo/buys-repo.js';
import { CreateBuyInput, UpdateBuyInput } from '../schemas/buys.js';
import { DateRangeQuery, IdParam, asyncHandler, respondBadRequest } from './_shared.js';

export interface BuysRouterDeps {
  repo: BuysRepo;
}

export function buysRouter(deps: BuysRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

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
      const parsed = DateRangeQuery.safeParse(req.query);
      if (!parsed.success) {
        return respondBadRequest(res, 'Parámetros inválidos', parsed.error.flatten());
      }
      const filters =
        parsed.data.from || parsed.data.to
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
        return respondBadRequest(res, 'Id inválido', parsed.error.flatten());
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
        return respondBadRequest(res, 'Datos de compra inválidos', parsed.error.flatten());
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
        return respondBadRequest(res, 'Id inválido', params.error.flatten());
      }
      const body = UpdateBuyInput.safeParse(req.body);
      if (!body.success) {
        return respondBadRequest(res, 'Datos de actualización inválidos', body.error.flatten());
      }
      const data = repo.update(params.data.id, body.data);
      if (!data) {
        return res.status(404).json({ error: 'Compra no encontrada', id: params.data.id });
      }
      res.json({ data });
    }),
  );

  router.delete(
    '/:id/cascade',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return respondBadRequest(res, 'Id inválido', parsed.error.flatten());
      }
      const id = parsed.data.id;
      if (!repo.getById(id)) {
        return res.status(404).json({ error: 'Compra no encontrada', id });
      }
      const affected = repo.listAssociatedSales(id);
      logger.warn(
        {
          buy_id: id,
          affected_sales: affected.map((s) => ({
            id: s.id,
            customer_name: s.customer_name,
            items_count: s.items_count,
          })),
        },
        'Borrado en cascada de compra (iniciado)',
      );
      let removed: boolean;
      try {
        removed = repo.removeWithCascade(id);
      } catch (err) {
        logger.error({ err, buy_id: id }, 'Borrado en cascada fallido: no se completó');
        throw err;
      }
      if (!removed) {
        logger.error({ buy_id: id }, 'Borrado en cascada sin efecto: la compra ya no existía');
        return res.status(404).json({ error: 'Compra no encontrada', id });
      }
      res.status(204).end();
    }),
  );

  router.delete(
    '/:id',
    asyncHandler(async (req, res) => {
      const parsed = IdParam.safeParse(req.params);
      if (!parsed.success) {
        return respondBadRequest(res, 'Id inválido', parsed.error.flatten());
      }
      const result = repo.remove(parsed.data.id);
      if (result.ok) {
        return res.status(204).end();
      }
      if (result.code === 'NOT_FOUND') {
        return res.status(404).json({ error: 'Compra no encontrada', id: parsed.data.id });
      }
      return res.status(409).json({
        error:
          'No se puede borrar: la compra tiene ventas asociadas. ¿Querés borrar también las ventas?',
        associated_sales: result.sales,
      });
    }),
  );

  return router;
}
