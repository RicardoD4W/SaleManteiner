import { Router, type NextFunction, type Request, type Response } from 'express';
import type { SoldsRepo } from '../repo/solds-repo.js';

export interface DashboardRouterDeps {
  repo: SoldsRepo;
}

function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    fn(req, res, next).catch(next);
  };
}

export function dashboardRouter(deps: DashboardRouterDeps): Router {
  const { repo } = deps;
  const router = Router();

  /**
   * GET /api/stats/dashboard — KPIs del nuevo modelo (S11 del feature).
   *
   * Payload:
   * {
   *   kpis: { compras_total_eur, ventas_total_eur, beneficio_total_eur, stock_pendiente_count },
   *   revenueByMonth: [{ month: 'YYYY-MM', revenue, profit }],
   *   topProducts: [{ product_name, times_sold, total_revenue, total_profit }],
   *   topBuyers: [{ customer_id, customer_name, ventas, total_gastado }],
   * }
   *
   * Series mensuales: últimos 12 meses calendario, incluyendo meses sin ventas (0).
   * topProducts y topBuyers: top 10.
   */
  router.get(
    '/dashboard',
    asyncHandler(async (_req, res) => {
      const data = repo.statsDashboard();
      res.json({ data });
    }),
  );

  return router;
}
