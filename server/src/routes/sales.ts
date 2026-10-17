import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import type { SalesRepo } from '../repo/sales-repo.js';
import { CreateSaleInput, UpdateSaleInput } from '../schemas/sales.js';
import { ImportSalesInput, ImportSalesOutput } from '../schemas/sales-import.js';
import { serializeSalesToCsv } from '../csv-export.js';

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

  /**
   * Fase 6 — Exportación CSV.
   *
   * Devuelve TODAS las ventas como CSV (sin paginación). Headers + BOM + escape
   * RFC 4180 los maneja `serializeSalesToCsv`. Filename sugerido con la fecha
   * local del export para que múltiples exports no se pisen en Downloads.
   *
   * Content-Type: `text/csv; charset=utf-8`. El BOM al inicio del body permite
   * que Excel-español detecte UTF-8 automáticamente (sin BOM abre con Latin-1).
   *
   * Va antes de `/:id` para que "export" no se interprete como un id numérico.
   */
  router.get(
    '/export',
    asyncHandler(async (_req, res) => {
      const sales = repo.list();
      const csv = serializeSalesToCsv(sales);
      const today = new Date().toISOString().slice(0, 10);
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="sales-${today}.csv"`,
      );
      res.send(csv);
    }),
  );

  /**
   * Fase 3 — Importación CSV.
   *
   * Acepta `{ sales: CreateSaleInput[] }` (1..1000 filas). Las filas ya pasan por
   * el schema completo (incluido el refine S3 `sold` ↔ `sold_at`), así que un
   * CSV impuro se rechaza entero y se devuelve 422 con el detalle por fila.
   * Si todas pasan, el repo las inserta en `db.transaction` (todo-o-nada en BD).
   *
   * 422 (Unprocessable Entity) en vez de 400 porque el body está bien formado
   * (JSON parseado OK) pero su contenido semántico no satisface el schema.
   */
  router.post(
    '/import',
    asyncHandler(async (req, res) => {
      const parsed = ImportSalesInput.safeParse(req.body);
      if (!parsed.success) {
        const totalRows = Array.isArray(req.body?.sales) ? req.body.sales.length : 0;
        return res.status(422).json({
          error: 'CSV contiene filas inválidas — no se importó ninguna venta',
          totalRows,
          issues: parsed.error.flatten(),
        });
      }
      const sales = repo.createMany(parsed.data.sales);
      const payload: ImportSalesOutput = {
        imported: sales.length,
        ids: sales.map((s) => s.id),
      };
      res.status(201).json({ data: payload });
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
