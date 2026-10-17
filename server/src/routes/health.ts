import { Router, type Request, type Response } from 'express';

export interface HealthRouterDeps {
  service: string;
  version: string;
}

export function healthRouter(deps: HealthRouterDeps): Router {
  const router = Router();

  router.get('/', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      service: deps.service,
      version: deps.version,
      now: new Date().toISOString(),
    });
  });

  return router;
}