import express, { type ErrorRequestHandler, type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { logger } from './logger.js';
import { healthRouter } from './routes/health.js';
import { salesRouter } from './routes/sales.js';
import type { SalesRepo } from './repo/sales-repo.js';

const SERVICE = 'salemanteiner-server';
const VERSION = '0.1.0';

export interface CreateAppDeps {
  salesRepo: SalesRepo;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api/health', healthRouter({ service: SERVICE, version: VERSION }));
  app.use('/api/sales', salesRouter({ repo: deps.salesRepo }));

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: 'Not Found', path: req.path });
  });

  // Error handler global. Necesita la firma de 4 args para que Express lo reconozca.
  const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
    logger.error({ err, path: req.path }, 'Unhandled error');
    res.status(500).json({ error: 'Internal Server Error' });
  };
  app.use(errorHandler);

  return app;
}
