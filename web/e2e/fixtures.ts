/**
 * Fixtures y helpers compartidos por los tests E2E.
 *
 * Estrategia de aislamiento:
 *  - Workers: 1 (configurado en playwright.config.ts). Una sola BD compartida.
 *  - En `beforeEach`, limpiamos todas las ventas vía DELETE /api/sales/:id
 *    para que cada test arranque con la BD vacía. Más simple que el caso
 *    multi-worker que necesitaría BDs separadas.
 *  - `seedSalesViaApi` crea ventas via HTTP directo (más rápido que la UI
 *    y no nos ata a la implementación del form).
 */
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

/** Forma mínima para crear una venta via API. */
export interface SaleSeed {
  product_name: string;
  buyer_name?: string;
  cost_cents: number;
  price_cents: number;
  associated_costs_cents?: number;
  sold?: boolean;
  /** ISO 8601. Si `sold: true` y se omite, se rellena con `new Date().toISOString()` para satisfacer la coherencia S3. */
  sold_at?: string;
  /** `YYYY-MM-DD`. Editable por el cliente. */
  purchase_date?: string;
  notes?: string;
}

export const test = base.extend<{ seedSales: (sales: SaleSeed[]) => Promise<number[]> }>({
  seedSales: async ({ request }, use) => {
    const fn = async (sales: SaleSeed[]) => {
      const created: number[] = [];
      for (const sale of sales) {
        // El refine S3 del schema exige coherencia `sold` ↔ `sold_at` en create.
        // Si el seed marca `sold: true` sin fecha, completamos con "ahora" para
        // no romper tests que solo les importa el flujo (no la fecha exacta).
        const body = {
          ...sale,
          sold_at: sale.sold ? (sale.sold_at ?? new Date().toISOString()) : null,
        };
        const res = await request.post('/api/sales', { data: body });
        expect(res.ok(), `POST /api/sales falló: ${res.status()}`).toBe(true);
        const json = (await res.json()) as { data: { id: number } };
        created.push(json.data.id);
      }
      return created;
    };
    // Playwright's `use` here is the fixture API, not React's hook.
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(fn);
  },
});

/** Limpia todas las ventas existentes via la API. Idempotente. */
export async function clearAllSales(request: APIRequestContext): Promise<void> {
  const res = await request.get('/api/sales?limit=200');
  expect(res.ok(), `GET /api/sales falló: ${res.status()}`).toBe(true);
  const body = (await res.json()) as { data: Array<{ id: number }> };
  for (const { id } of body.data) {
    const del = await request.delete(`/api/sales/${id}`);
    expect(del.ok(), `DELETE /api/sales/${id} falló: ${del.status()}`).toBe(true);
  }
}

/** Espera a que el KPI "Total" muestre el número esperado. */
export async function expectTotal(page: Page, total: number): Promise<void> {
  // El KPI "Total" tiene el label "Total" y el value es el conteo.
  // Buscamos el label y luego el número cerca.
  const totalCard = page.getByText('Total', { exact: true }).locator('..');
  await expect(totalCard).toContainText(String(total));
}

/** Espera a que el KPI "Beneficio neto" muestre el importe. */
export async function expectNetProfit(page: Page, cents: number): Promise<void> {
  const eurFormatter = new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
  });
  const formatted = eurFormatter.format(cents / 100);
  // Para positivos el componente agrega "+", para negativos `formatCents`
  // ya incluye el "-".
  const expected = (cents >= 0 ? '+' : '') + formatted;
  await expect(page.getByText(expected)).toBeVisible();
}

/** Navega a / y espera a que termine el loading (que aparezca la tabla O el empty state). */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/');
  // Espera a que termine el estado loading (desaparece el spinner).
  await page.waitForFunction(
    () => !document.body.textContent?.includes('Cargando'),
    null,
    { timeout: 10_000 },
  );
}