import { describe, expect, it } from 'vitest';
import { ENDPOINTS, PROFILES, runBench } from '../scripts/bench.js';

describe('banco de medición', () => {
  it('mide todos los endpoints sobre una BD temporal sembrada', async () => {
    const report = await runBench({ profile: 'tiny', iterations: 2, warmup: 1 });

    expect(report.profile).toBe('tiny');
    expect(report.rows.solds).toBe(PROFILES.tiny.solds);
    expect(report.rows.buys).toBe(PROFILES.tiny.buys);
    expect(report.rows.customers).toBe(PROFILES.tiny.customers);

    expect(report.endpoints.map((endpoint) => endpoint.id)).toEqual(
      ENDPOINTS.map((endpoint) => endpoint.id),
    );

    for (const endpoint of report.endpoints) {
      expect(endpoint.status).toBe(200);
      expect(endpoint.samples).toBe(2);
      expect(endpoint.p95).toBeGreaterThanOrEqual(0);
      expect(endpoint.statements).toBeGreaterThan(0);
    }
  });

  it('recoge el SQL ejecutado y su plan de ejecución', async () => {
    const report = await runBench({ profile: 'tiny', iterations: 1, warmup: 0 });

    expect(report.statements.length).toBeGreaterThan(0);
    expect(report.plans.length).toBeGreaterThan(0);

    const dashboard = report.endpoints.find((endpoint) => endpoint.id === 'stats/dashboard');
    expect(dashboard).toBeDefined();
    expect(dashboard?.statements).toBeGreaterThanOrEqual(10);

    for (const plan of report.plans) {
      expect(plan.plan.length).toBeGreaterThan(0);
    }
  });

  it('no toca la BD del usuario: la base de datos vive en un directorio temporal', async () => {
    const report = await runBench({ profile: 'tiny', iterations: 1, warmup: 0 });
    expect(report.dbBytes).toBeGreaterThan(0);
    expect(report.indexes.length).toBeGreaterThan(0);
  });

  it('mide tambien el camino de escritura sin alterar el volumen sembrado', async () => {
    const report = await runBench({ profile: 'tiny', iterations: 2, warmup: 1 });

    expect(report.writes.map((write) => write.id)).toEqual([
      'sold-1-item',
      'sold-10-items',
      'sold-50-items',
      'buy-cascade',
    ]);

    for (const write of report.writes) {
      expect(write.status).toBeLessThan(300);
      expect(write.samples).toBe(2);
      expect(write.statements).toBeGreaterThan(0);
    }

    expect(report.rows.buys).toBe(PROFILES.tiny.buys);
    expect(report.rows.solds).toBe(PROFILES.tiny.solds);
  });
});
