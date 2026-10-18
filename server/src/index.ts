import { createApp } from './app.js';
import { logger } from './logger.js';
import { openDb } from './db/index.js';
import { runMigrations } from './db/migrate.js';
import { createBuysRepo } from './repo/buys-repo.js';
import { createSoldsRepo } from './repo/solds-repo.js';
import { createCustomersRepo } from './repo/customers-repo.js';
import { DB_PATH, HOST, PORT } from './config.js';

const db = openDb(DB_PATH);
runMigrations(db);
const buysRepo = createBuysRepo(db);
const soldsRepo = createSoldsRepo(db);
const customersRepo = createCustomersRepo(db);

const app = createApp({ buysRepo, soldsRepo, customersRepo });

const server = app.listen(PORT, HOST, () => {
  logger.info({ port: PORT, host: HOST, dbPath: DB_PATH }, 'SaleManteiner server listening');
});

// Apagado limpio
function shutdown(signal: string): void {
  logger.info({ signal }, 'Cerrando servidor…');
  server.close((err) => {
    if (err) {
      logger.error({ err }, 'Error cerrando servidor');
      db.close();
      process.exit(1);
    }
    db.close();
    logger.info('Servidor cerrado limpiamente');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
