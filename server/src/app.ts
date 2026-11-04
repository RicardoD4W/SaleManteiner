import express, { type ErrorRequestHandler, type Express } from 'express';
import cors from 'cors';
import { pinoHttp } from 'pino-http';
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { logger } from './logger.js';
import { WEB_DIR } from './config.js';
import { healthRouter } from './routes/health.js';
import { versionRouter } from './routes/version.js';
import { buysRouter } from './routes/buys.js';
import { productsRouter } from './routes/products.js';
import { soldsRouter } from './routes/solds.js';
import { customersRouter } from './routes/customers.js';
import { dashboardRouter } from './routes/dashboard.js';
import { metricsRouter } from './routes/metrics.js';
import { backupsRouter } from './routes/backups.js';
import { expensesRouter } from './routes/expenses.js';
import { expenseCategoriesRouter } from './routes/expense-categories.js';
import type { BuysRepo } from './repo/buys-repo.js';
import type { SoldsRepo } from './repo/solds-repo.js';
import type { CustomersRepo } from './repo/customers-repo.js';
import { createExpenseCategoriesRepo, createExpensesRepo } from './repo/expenses-repo.js';
import type { ExpenseCategoriesRepo, ExpensesRepo } from './repo/expenses-repo.js';
import { createMetricsRepo } from './repo/metrics-repo.js';
import type { MetricsRepo } from './repo/metrics-repo.js';
import type { BackupService } from './backup/backup-service.js';

const SERVICE = 'salemanteiner-server';
const { version: VERSION } = createRequire(import.meta.url)('../package.json') as {
  version: string;
};

export interface CreateAppDeps {
  buysRepo: BuysRepo;
  soldsRepo: SoldsRepo;
  customersRepo: CustomersRepo;
  expensesRepo?: ExpensesRepo;
  expenseCategoriesRepo?: ExpenseCategoriesRepo;
  metricsRepo?: MetricsRepo;
  backupService?: BackupService;
  webDir?: string | null;
}

export function createApp(deps: CreateAppDeps): Express {
  const app = express();

  const expensesRepo = deps.expensesRepo ?? createExpensesRepo(deps.customersRepo.db);
  const expenseCategoriesRepo =
    deps.expenseCategoriesRepo ?? createExpenseCategoriesRepo(deps.customersRepo.db);
  const metricsRepo = deps.metricsRepo ?? createMetricsRepo(deps.customersRepo.db);

  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));

  app.use('/api/health', healthRouter({ service: SERVICE, version: VERSION }));
  app.use('/api/version', versionRouter());
  app.use('/api/buys', buysRouter({ repo: deps.buysRepo }));
  app.use('/api/products', productsRouter({ repo: deps.buysRepo }));
  app.use('/api/solds', soldsRouter({ repo: deps.soldsRepo }));
  app.use('/api/customers', customersRouter({ repo: deps.customersRepo }));
  app.use('/api/expenses', expensesRouter({ repo: expensesRepo }));
  app.use('/api/expense-categories', expenseCategoriesRouter({ repo: expenseCategoriesRepo }));
  app.use('/api/stats', dashboardRouter({ repo: deps.soldsRepo }));
  app.use('/api/stats', metricsRouter({ repo: metricsRepo }));
  if (deps.backupService) {
    app.use('/api/backups', backupsRouter({ service: deps.backupService }));
  }

  const webDir = deps.webDir === undefined ? WEB_DIR : deps.webDir;
  if (webDir && existsSync(webDir)) {
    app.use(express.static(webDir, { index: false }));
    app.get(/^(?!\/api\/).*/, (req, res, next) => {
      if (path.extname(req.path)) return next();
      if (!req.accepts('html')) return next();
      res.sendFile(path.join(webDir, 'index.html'));
    });
    logger.info({ webDir }, 'Sirviendo el web compilado');
  }

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
