import express, { type ErrorRequestHandler, type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { createRequire } from 'node:module';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';
import { buysRouter } from './routes/buys.js';
import { soldsRouter } from './routes/solds.js';
import { customersRouter } from './routes/customers.js';
import { dashboardRouter } from './routes/dashboard.js';
import type { BuysRepo } from './repo/buys-repo.js';
import type { SoldsRepo } from './repo/solds-repo.js';
import type { CustomersRepo } from './repo/customers-repo.js';

const SERVICE = 'salemanteiner-server';
const { version: VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

export interface CreateAppDeps {
  buysRepo: BuysRepo;
  soldsRepo: SoldsRepo;
  customersRepo: CustomersRepo;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api/health', healthRouter({ service: SERVICE, version: VERSION }));
  app.use('/api/buys', buysRouter({ repo: deps.buysRepo }));
  app.use('/api/solds', soldsRouter({ repo: deps.soldsRepo }));
  app.use('/api/customers', customersRouter({ repo: deps.customersRepo }));
  app.use('/api/stats', dashboardRouter({ repo: deps.soldsRepo }));

  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    const status = Number(
      (err as { status?: unknown; statusCode?: unknown }).status ??
        (err as { statusCode?: unknown }).statusCode,
    );
    if (Number.isInteger(status) && status >= 400 && status < 500) {
      logger.warn({ path: req.path, status }, 'Invalid request');
      res.status(status).json({ error: 'Invalid request' });
      return;
    }
    logger.error({ err, path: req.path }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Server Error' });
  };
  app.use(errorHandler);

  return app;
}
