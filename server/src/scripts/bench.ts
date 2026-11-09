import { once } from 'node:events';
import { existsSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Database } from 'better-sqlite3';
import { openDb } from '../db/index.js';
import { runMigrations } from '../db/migrate.js';
import { createBuysRepo } from '../repo/buys-repo.js';
import { createCustomersRepo } from '../repo/customers-repo.js';
import { createSoldsRepo } from '../repo/solds-repo.js';

export interface BenchProfile {
  name: string;
  customers: number;
  buys: number;
  solds: number;
  itemsPerSold: number;
  expenses: number;
  months: number;
}

export const PROFILES: Record<string, BenchProfile> = {
  tiny: {
    name: 'tiny',
    customers: 10,
    buys: 20,
    solds: 30,
    itemsPerSold: 2,
    expenses: 20,
    months: 6,
  },
  small: {
    name: 'small',
    customers: 100,
    buys: 500,
    solds: 1000,
    itemsPerSold: 2,
    expenses: 300,
    months: 12,
  },
  medium: {
    name: 'medium',
    customers: 500,
    buys: 2000,
    solds: 5000,
    itemsPerSold: 3,
    expenses: 1000,
    months: 24,
  },
  large: {
    name: 'large',
    customers: 2000,
    buys: 10000,
    solds: 25000,
    itemsPerSold: 3,
    expenses: 5000,
    months: 24,
  },
};

export interface BenchEndpoint {
  id: string;
  path: string;
}

export const ENDPOINTS: BenchEndpoint[] = [
  { id: 'stats/dashboard', path: '/api/stats/dashboard' },
  { id: 'stats/metrics', path: '/api/stats/metrics' },
  { id: 'solds', path: '/api/solds' },
  { id: 'buys', path: '/api/buys' },
  { id: 'customers', path: '/api/customers' },
  { id: 'customers-search', path: '/api/customers?name=Cliente%20000' },
  { id: 'expenses', path: '/api/expenses' },
  { id: 'products', path: '/api/products' },
];

export interface EndpointResult {
  id: string;
  path: string;
  status: number;
  samples: number;
  bytes: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  statements: number;
  sqlMs: number;
}

export interface WriteResult {
  id: string;
  method: string;
  path: string;
  status: number;
  samples: number;
  min: number;
  mean: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  statements: number;
  sqlMs: number;
}

export interface StatementStat {
  sql: string;
  count: number;
  totalMs: number;
  endpoints: string[];
}

export interface PlanInfo {
  sql: string;
  endpoint: string;
  plan: string[];
  usesIndex: boolean;
  fullScans: string[];
}

export interface BenchReport {
  profile: string;
  seed: number;
  rows: Record<string, number>;
  indexes: string[];
  endpoints: EndpointResult[];
  writes: WriteResult[];
  statements: StatementStat[];
  endpointStatements: Record<string, StatementStat[]>;
  writeStatements: Record<string, StatementStat[]>;
  plans: PlanInfo[];
  dbBytes: number;
  totalMs: number;
}

export interface BenchOptions {
  profile?: string;
  iterations?: number;
  warmup?: number;
  seed?: number;
  keep?: boolean;
  dir?: string;
}

interface SqlEvent {
  sql: string;
  params: unknown[];
  ms: number;
}

interface Collector {
  db: Database;
  events: SqlEvent[];
  collecting: boolean;
}

interface PlanRow {
  detail: string;
}

const PRODUCT_NAMES = [
  'Camiseta vintage',
  'Chaqueta de cuero',
  'Zapatillas Nike',
  'Reloj Casio',
  'Cámara réflex',
  'Mesa de madera',
  'Silla oficina',
  'Lámpara diseño',
  'Libros lote',
  'Vinilos rock',
  'Consola retro',
  'Juego de mesa',
  'Bicicleta urbana',
  'Fitnesssmith',
  'Coche de precisión',
  'Ordenador portátil',
  'Móvil gama media',
  'Tablet 10 pulgadas',
  'Auriculares bluetooth',
  'Altavoz portátil',
];

const EXPENSE_CATEGORIES = [
  'Transporte',
  'Embalaje',
  'Comisiones',
  'Publicidad',
  'Herramientas',
  'Impuestos',
];

const COUNT_QUERIES: Record<string, string> = {
  customers: 'SELECT COUNT(*) AS c FROM customers',
  buys: 'SELECT COUNT(*) AS c FROM buys',
  solds: 'SELECT COUNT(*) AS c FROM solds',
  sale_items: 'SELECT COUNT(*) AS c FROM sale_items',
  expenses: 'SELECT COUNT(*) AS c FROM expenses',
  expense_categories: 'SELECT COUNT(*) AS c FROM expense_categories',
};

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function randomDate(rand: () => number, maxDaysBack: number): string {
  const date = new Date();
  date.setDate(date.getDate() - Math.floor(rand() * maxDaysBack));
  date.setHours(Math.floor(rand() * 24), Math.floor(rand() * 60), Math.floor(rand() * 60), 0);
  return date.toISOString();
}

function seedDatabase(db: Database, profile: BenchProfile, seed: number): void {
  const rand = mulberry32(seed);
  const maxDays = profile.months * 30;

  const insertCustomer = db.prepare('INSERT INTO customers (name, created_at) VALUES (?, ?)');
  const insertBuy = db.prepare(
    'INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const insertSold = db.prepare(
    'INSERT INTO solds (customer_id, sale_price, associated_costs, sold_at, notes, created_at, paid_amount) VALUES (?, ?, ?, ?, NULL, ?, ?)',
  );
  const insertItem = db.prepare(
    'INSERT INTO sale_items (sold_id, buy_id, quantity) VALUES (?, ?, ?)',
  );
  const insertCategory = db.prepare(
    'INSERT INTO expense_categories (name, created_at) VALUES (?, ?)',
  );
  const insertExpense = db.prepare(
    'INSERT INTO expenses (concept, amount, category_id, expense_date, created_at) VALUES (?, ?, ?, ?, ?)',
  );

  const soldUnitsPerBuy = new Map<number, number>();
  const soldPlans: Array<{ customerId: number; items: Array<{ buyId: number; qty: number }> }> = [];

  for (let i = 0; i < profile.solds; i += 1) {
    const customerId = 1 + Math.floor(rand() * profile.customers);
    const itemCount = 1 + Math.floor(rand() * profile.itemsPerSold);
    const chosen = new Set<number>();
    const items: Array<{ buyId: number; qty: number }> = [];
    while (chosen.size < itemCount) {
      const buyId = 1 + Math.floor(rand() * profile.buys);
      if (chosen.has(buyId)) continue;
      chosen.add(buyId);
      const qty = 1 + Math.floor(rand() * 3);
      items.push({ buyId, qty });
      soldUnitsPerBuy.set(buyId, (soldUnitsPerBuy.get(buyId) ?? 0) + qty);
    }
    soldPlans.push({ customerId, items });
  }

  const run = db.transaction(() => {
    for (let i = 0; i < profile.customers; i += 1) {
      insertCustomer.run(`Cliente ${String(i + 1).padStart(4, '0')}`, randomDate(rand, maxDays));
    }

    for (let buyId = 1; buyId <= profile.buys; buyId += 1) {
      const soldUnits = soldUnitsPerBuy.get(buyId) ?? 0;
      const quantity = soldUnits + 1 + Math.floor(rand() * 6);
      const unitPrice = round2(5 + rand() * 195);
      const purchaseCost = unitPrice;
      const associated = round2(rand() * 40);
      insertBuy.run(
        PRODUCT_NAMES[buyId % PRODUCT_NAMES.length],
        purchaseCost,
        quantity,
        associated,
        randomDate(rand, maxDays),
        randomDate(rand, maxDays),
      );
    }

    let soldId = 0;
    for (const plan of soldPlans) {
      soldId += 1;
      const salePrice = round2(20 + rand() * 480);
      const associated = round2(rand() * 30);
      const paid = rand() < 0.25 ? round2(salePrice * rand() * 0.9) : salePrice;
      insertSold.run(
        plan.customerId,
        salePrice,
        associated,
        randomDate(rand, maxDays),
        randomDate(rand, maxDays),
        paid,
      );
      for (const item of plan.items) {
        insertItem.run(soldId, item.buyId, item.qty);
      }
    }

    const categoryIds: number[] = [];
    for (const category of EXPENSE_CATEGORIES) {
      const info = insertCategory.run(category, randomDate(rand, maxDays));
      categoryIds.push(Number(info.lastInsertRowid));
    }

    for (let i = 0; i < profile.expenses; i += 1) {
      const categoryId = categoryIds[Math.floor(rand() * categoryIds.length)];
      insertExpense.run(
        `Gasto ${i + 1}`,
        round2(5 + rand() * 250),
        categoryId,
        randomDate(rand, maxDays),
        randomDate(rand, maxDays),
      );
    }
  });

  run();
}

function instrument(db: Database): Collector {
  const collector: Collector = { db, events: [], collecting: false };
  const originalPrepare = db.prepare.bind(db);

  const patchedPrepare = (sql: string) => {
    const statement = originalPrepare(sql);
    return new Proxy(statement, {
      get(target, property) {
        const value: unknown = Reflect.get(target, property, target);
        if (property !== 'all' && property !== 'get' && property !== 'run') {
          return typeof value === 'function' ? value.bind(target) : value;
        }
        const call = value as (...params: unknown[]) => unknown;
        return (...args: unknown[]) => {
          const start = performance.now();
          const result = call.apply(target, args);
          if (collector.collecting) {
            collector.events.push({ sql, params: args, ms: performance.now() - start });
          }
          return result;
        };
      },
    });
  };

  collector.db = new Proxy(db, {
    get(target, property) {
      if (property === 'prepare') return patchedPrepare;
      const value: unknown = Reflect.get(target, property, target);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  return collector;
}

function dbSize(dbPath: string): number {
  const files = [dbPath, `${dbPath}-wal`];
  return files.reduce((acc, file) => acc + (existsSync(file) ? statSync(file).size : 0), 0);
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[index];
}

function rowCounts(db: Database): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const [table, sql] of Object.entries(COUNT_QUERIES)) {
    const row = db.prepare(sql).get() as { c: number };
    counts[table] = row.c;
  }
  return counts;
}

function indexInventory(db: Database): string[] {
  const rows = db
    .prepare(
      "SELECT name, tbl_name FROM sqlite_master WHERE type = 'index' ORDER BY tbl_name, name",
    )
    .all() as Array<{ name: string; tbl_name: string }>;
  return rows.map((row) => `${row.tbl_name}.${row.name}`);
}

function isExplainable(sql: string): boolean {
  return /^\s*(select|with)\b/i.test(sql);
}

function explainQuery(db: Database, sql: string, params: unknown[]): string[] {
  const statement = db.prepare<unknown[], PlanRow>('EXPLAIN QUERY PLAN ' + sql);
  return statement.all(...params).map((row) => row.detail);
}

function analyzePlan(sql: string, endpoint: string, plan: string[]): PlanInfo {
  const usesIndex = plan.some(
    (detail) =>
      detail.includes('USING COVERING INDEX') ||
      detail.includes('USING INDEX') ||
      detail.includes('USING PRIMARY KEY'),
  );
  const fullScans = plan
    .filter((detail) => /SCAN \w+(?! USING)/.test(detail))
    .map((detail) => detail.trim());
  return { sql, endpoint, plan, usesIndex, fullScans };
}

async function requestJson(
  baseUrl: string,
  endpoint: BenchEndpoint,
): Promise<{ status: number; bytes: number; ms: number }> {
  const start = performance.now();
  const response = await fetch(`${baseUrl}${endpoint.path}`);
  const text = await response.text();
  const ms = performance.now() - start;
  return { status: response.status, bytes: text.length, ms };
}

const WRITE_ITEM_COUNTS = [1, 10, 50];

function prepareWriteBuys(db: Database, count: number): number[] {
  const insert = db.prepare(
    `INSERT INTO buys (product_name, purchase_cost, quantity, associated_costs, purchase_date, created_at)
     VALUES (?, 10, 100000, 0, ?, ?)`,
  );
  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const ids: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const info = insert.run(`Compra de escritura ${i + 1}`, today, now);
    ids.push(Number(info.lastInsertRowid));
  }
  return ids;
}

async function writeRequest(
  baseUrl: string,
  method: 'POST' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<{ status: number; bytes: number; ms: number }> {
  const start = performance.now();
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    ...(body === undefined
      ? {}
      : { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }),
  });
  const text = await response.text();
  const ms = performance.now() - start;
  return { status: response.status, bytes: text.length, ms };
}

async function measureWrite(
  id: string,
  method: 'POST' | 'DELETE',
  path: string,
  samples: number,
  collector: Collector,
  operation: (index: number) => Promise<{ status: number; bytes: number; ms: number }>,
): Promise<{ result: WriteResult; statements: StatementStat[] }> {
  collector.events = [];
  collector.collecting = true;
  const timings: number[] = [];
  let status = 0;
  for (let i = 0; i < samples; i += 1) {
    const result = await operation(i);
    timings.push(result.ms);
    status = result.status;
  }
  collector.collecting = false;

  const perSql = new Map<string, StatementStat>();
  for (const event of collector.events) {
    const existing = perSql.get(event.sql) ?? {
      sql: event.sql,
      count: 0,
      totalMs: 0,
      endpoints: [id],
    };
    existing.count += 1;
    existing.totalMs += event.ms;
    perSql.set(event.sql, existing);
  }

  const sorted = [...timings].sort((a, b) => a - b);
  const total = timings.reduce((acc, value) => acc + value, 0);
  const sqlMs = [...perSql.values()].reduce((acc, stat) => acc + stat.totalMs, 0);

  return {
    result: {
      id,
      method,
      path,
      status,
      samples: timings.length,
      min: round2(sorted[0] ?? 0),
      mean: round2(total / Math.max(1, timings.length)),
      p50: round2(percentile(sorted, 50)),
      p95: round2(percentile(sorted, 95)),
      p99: round2(percentile(sorted, 99)),
      max: round2(sorted[sorted.length - 1] ?? 0),
      statements: collector.events.length / Math.max(1, samples),
      sqlMs: round2(sqlMs / Math.max(1, samples)),
    },
    statements: [...perSql.values()]
      .map((stat) => ({
        sql: stat.sql,
        count: Math.round(stat.count / Math.max(1, samples)),
        totalMs: round2(stat.totalMs / Math.max(1, samples)),
        endpoints: [id],
      }))
      .sort((a, b) => b.totalMs - a.totalMs),
  };
}

async function runWriteBench(
  baseUrl: string,
  db: Database,
  collector: Collector,
  samples: number,
): Promise<{ writes: WriteResult[]; writeStatements: Record<string, StatementStat[]> }> {
  const writes: WriteResult[] = [];
  const writeStatements: Record<string, StatementStat[]> = {};

  const buyIds = prepareWriteBuys(db, Math.max(...WRITE_ITEM_COUNTS));

  for (const itemCount of WRITE_ITEM_COUNTS) {
    const id = itemCount === 1 ? 'sold-1-item' : `sold-${itemCount}-items`;
    const body = {
      customer_id: 1,
      sale_price: 100,
      items: buyIds.slice(0, itemCount).map((buy_id) => ({ buy_id, quantity: 1 })),
    };
    const { result, statements } = await measureWrite(
      id,
      'POST',
      '/api/solds',
      samples,
      collector,
      () => writeRequest(baseUrl, 'POST', '/api/solds', body),
    );
    writes.push(result);
    writeStatements[id] = statements;
  }

  const cascadeBuyIds = prepareWriteBuys(db, samples);
  for (const buyId of cascadeBuyIds) {
    await writeRequest(baseUrl, 'POST', '/api/solds', {
      customer_id: 1,
      sale_price: 100,
      items: [{ buy_id: buyId, quantity: 1 }],
    });
  }
  const { result, statements } = await measureWrite(
    'buy-cascade',
    'DELETE',
    '/api/buys/:id/cascade',
    samples,
    collector,
    (index) => writeRequest(baseUrl, 'DELETE', `/api/buys/${cascadeBuyIds[index]}/cascade`),
  );
  writes.push(result);
  writeStatements['buy-cascade'] = statements;

  return { writes, writeStatements };
}

export async function runBench(options: BenchOptions = {}): Promise<BenchReport> {
  const profileName = options.profile ?? 'medium';
  const profile = PROFILES[profileName];
  if (!profile) throw new Error(`Perfil desconocido: ${profileName}`);
  const iterations = options.iterations ?? 30;
  const warmup = options.warmup ?? 3;
  const seed = options.seed ?? 20261104;
  const totalStart = performance.now();

  const baseDir = options.dir ?? mkdtempSync(path.join(tmpdir(), 'salemanteiner-bench-'));
  const dbPath = path.join(baseDir, 'data.db');
  const rawDb = openDb(dbPath);
  runMigrations(rawDb);
  seedDatabase(rawDb, profile, seed);

  const collector = instrument(rawDb);

  process.env.LOG_LEVEL = 'silent';
  process.env.NODE_ENV = 'production';
  const { createApp } = await import('../app.js');
  const app = createApp({
    buysRepo: createBuysRepo(collector.db),
    soldsRepo: createSoldsRepo(collector.db),
    customersRepo: createCustomersRepo(collector.db),
    webDir: null,
  });

  const server = app.listen(0);
  await once(server, 'listening');
  const address = server.address() as AddressInfo;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const statementsByEndpoint = new Map<string, Map<string, StatementStat>>();
  const plans: PlanInfo[] = [];
  const endpoints: EndpointResult[] = [];

  for (const endpoint of ENDPOINTS) {
    for (let i = 0; i < warmup; i += 1) {
      await requestJson(baseUrl, endpoint);
    }

    collector.events = [];
    collector.collecting = true;
    const samples: number[] = [];
    let status = 0;
    let bytes = 0;
    for (let i = 0; i < iterations; i += 1) {
      const result = await requestJson(baseUrl, endpoint);
      samples.push(result.ms);
      status = result.status;
      bytes = result.bytes;
    }
    collector.collecting = false;

    const perEndpoint = new Map<string, StatementStat>();
    const lastParams = new Map<string, unknown[]>();
    for (const event of collector.events) {
      const existing = perEndpoint.get(event.sql) ?? {
        sql: event.sql,
        count: 0,
        totalMs: 0,
        endpoints: [],
      };
      existing.count += 1;
      existing.totalMs += event.ms;
      if (!existing.endpoints.includes(endpoint.id)) existing.endpoints.push(endpoint.id);
      perEndpoint.set(event.sql, existing);
      lastParams.set(event.sql, event.params);
    }
    statementsByEndpoint.set(endpoint.id, perEndpoint);

    for (const sql of perEndpoint.keys()) {
      if (!isExplainable(sql)) continue;
      const plan = explainQuery(rawDb, sql, lastParams.get(sql) ?? []);
      plans.push(analyzePlan(sql, endpoint.id, plan));
    }

    const sorted = [...samples].sort((a, b) => a - b);
    const total = samples.reduce((acc, value) => acc + value, 0);
    const sqlMs = [...perEndpoint.values()].reduce((acc, stat) => acc + stat.totalMs, 0);

    endpoints.push({
      id: endpoint.id,
      path: endpoint.path,
      status,
      samples: samples.length,
      bytes,
      min: round2(sorted[0] ?? 0),
      mean: round2(total / Math.max(1, samples.length)),
      p50: round2(percentile(sorted, 50)),
      p95: round2(percentile(sorted, 95)),
      p99: round2(percentile(sorted, 99)),
      max: round2(sorted[sorted.length - 1] ?? 0),
      statements: collector.events.length / Math.max(1, iterations),
      sqlMs: round2(sqlMs / Math.max(1, iterations)),
    });
  }

  const uniqueStatements = new Map<string, StatementStat>();
  for (const map of statementsByEndpoint.values()) {
    for (const [sql, stat] of map) {
      const existing = uniqueStatements.get(sql);
      const normalized: StatementStat = {
        sql,
        count: Math.round(stat.count / Math.max(1, iterations)),
        totalMs: round2(stat.totalMs / Math.max(1, iterations)),
        endpoints: [...stat.endpoints],
      };
      if (!existing) {
        uniqueStatements.set(sql, normalized);
        continue;
      }
      existing.count += normalized.count;
      existing.totalMs = round2(existing.totalMs + normalized.totalMs);
      for (const endpointId of normalized.endpoints) {
        if (!existing.endpoints.includes(endpointId)) existing.endpoints.push(endpointId);
      }
    }
  }

  const seededRows = rowCounts(rawDb);
  const seededDbBytes = dbSize(dbPath);

  const { writes, writeStatements } = await runWriteBench(baseUrl, rawDb, collector, iterations);

  const report: BenchReport = {
    profile: profile.name,
    seed,
    rows: seededRows,
    indexes: indexInventory(rawDb),
    endpoints,
    writes,
    statements: [...uniqueStatements.values()]
      .map((stat) => ({ ...stat, totalMs: round2(stat.totalMs) }))
      .sort((a, b) => b.totalMs - a.totalMs),
    endpointStatements: Object.fromEntries(
      [...statementsByEndpoint.entries()].map(([endpointId, map]) => [
        endpointId,
        [...map.values()]
          .map((stat) => ({
            sql: stat.sql,
            count: Math.round(stat.count / Math.max(1, iterations)),
            totalMs: round2(stat.totalMs / Math.max(1, iterations)),
            endpoints: [endpointId],
          }))
          .sort((a, b) => b.totalMs - a.totalMs),
      ]),
    ),
    writeStatements,
    plans,
    dbBytes: seededDbBytes,
    totalMs: round2(performance.now() - totalStart),
  };

  await new Promise<void>((resolve) => server.close(() => resolve()));
  rawDb.close();
  if (!options.keep && !options.dir) {
    rmSync(baseDir, { recursive: true, force: true });
  }

  return report;
}

function formatRow(cells: string[], widths: number[]): string {
  return cells
    .map((cell, index) => cell.padEnd(widths[index]))
    .join('  ')
    .trimEnd();
}

export function formatReport(report: BenchReport): string {
  const lines: string[] = [];
  lines.push(`# Banco de medición — perfil ${report.profile} (seed ${report.seed})`);
  lines.push('');
  lines.push('## Volumen sembrado');
  lines.push(formatRow(['tabla', 'filas'], [24, 12]));
  for (const [table, count] of Object.entries(report.rows)) {
    lines.push(formatRow([table, String(count)], [24, 12]));
  }
  lines.push(`tamaño BD: ${(report.dbBytes / 1024 / 1024).toFixed(2)} MB`);
  lines.push('');

  lines.push('## Latencia por endpoint (ms)');
  lines.push(
    formatRow(
      ['endpoint', 'p50', 'p95', 'p99', 'max', 'bytes', 'stmts', 'sql ms'],
      [18, 9, 9, 9, 9, 10, 7, 9],
    ),
  );
  for (const endpoint of report.endpoints) {
    lines.push(
      formatRow(
        [
          endpoint.id,
          String(endpoint.p50),
          String(endpoint.p95),
          String(endpoint.p99),
          String(endpoint.max),
          String(endpoint.bytes),
          String(endpoint.statements),
          String(endpoint.sqlMs),
        ],
        [18, 9, 9, 9, 9, 10, 7, 9],
      ),
    );
  }
  lines.push('');

  lines.push('## Escrituras (ms por operación)');
  lines.push(
    formatRow(
      ['operación', 'método', 'p50', 'p95', 'p99', 'max', 'stmts', 'sql ms'],
      [18, 8, 9, 9, 9, 9, 7, 9],
    ),
  );
  for (const write of report.writes) {
    lines.push(
      formatRow(
        [
          write.id,
          write.method,
          String(write.p50),
          String(write.p95),
          String(write.p99),
          String(write.max),
          String(write.statements),
          String(write.sqlMs),
        ],
        [18, 8, 9, 9, 9, 9, 7, 9],
      ),
    );
  }
  lines.push('');

  lines.push('## Consultas por escritura');
  for (const write of report.writes) {
    const stats = report.writeStatements[write.id] ?? [];
    lines.push(`### ${write.id} — ${write.statements} ejecuciones, ${write.sqlMs} ms de SQL`);
    for (const stat of stats) {
      lines.push(`- [${stat.count}x, ${stat.totalMs} ms] ${stat.sql.replace(/\s+/g, ' ').trim()}`);
    }
    lines.push('');
  }

  lines.push('## Consultas por endpoint (veces por petición y ms de SQL por petición)');
  for (const endpoint of report.endpoints) {
    const stats = report.endpointStatements[endpoint.id] ?? [];
    lines.push(
      `### ${endpoint.id} — ${endpoint.statements} ejecuciones, ${endpoint.sqlMs} ms de SQL`,
    );
    for (const stat of stats) {
      lines.push(`- [${stat.count}x, ${stat.totalMs} ms] ${stat.sql.replace(/\s+/g, ' ').trim()}`);
    }
    lines.push('');
  }

  lines.push('## Planes (EXPLAIN QUERY PLAN)');
  for (const plan of report.plans) {
    lines.push(`### ${plan.endpoint}`);
    lines.push(`SQL: ${plan.sql.replace(/\s+/g, ' ').trim()}`);
    lines.push(
      `índice: ${plan.usesIndex ? 'sí' : 'NO'} | escaneo completo: ${plan.fullScans.length}`,
    );
    for (const detail of plan.plan) lines.push(`  ${detail}`);
    lines.push('');
  }

  lines.push('## Índices existentes');
  for (const index of report.indexes) lines.push(`- ${index}`);

  return lines.join('\n');
}

function parseArgs(argv: string[]): BenchOptions & { json?: string } {
  const options: BenchOptions & { json?: string } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];
    switch (arg) {
      case '--profile':
        options.profile = next;
        i += 1;
        break;
      case '--iterations':
        options.iterations = Number(next);
        i += 1;
        break;
      case '--warmup':
        options.warmup = Number(next);
        i += 1;
        break;
      case '--seed':
        options.seed = Number(next);
        i += 1;
        break;
      case '--dir':
        options.dir = next;
        i += 1;
        break;
      case '--keep':
        options.keep = true;
        break;
      case '--json':
        options.json = next;
        i += 1;
        break;
      default:
        break;
    }
  }
  return options;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const report = await runBench(options);
  console.log(formatReport(report));
  if (options.json) {
    const { writeFileSync } = await import('node:fs');
    writeFileSync(options.json, JSON.stringify(report, null, 2), 'utf-8');
  }
}

const invokedDirectly = process.argv[1] !== undefined && process.argv[1].endsWith('bench.ts');

if (invokedDirectly) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
