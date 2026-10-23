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

  router.get(
    '/dashboard',
    asyncHandler(async (_req, res) => {
      const data = repo.statsDashboard();
      res.json({ data });
    }),
  );

  return router;
}
