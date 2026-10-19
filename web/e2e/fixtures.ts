/**
 * Fixtures y helpers compartidos por los tests E2E del modelo `buys + solds
 * + customers` (feature `buys-and-solds`).
 *
 * Estrategia de aislamiento:
 *  - Workers: 1 (configurado en playwright.config.ts). Una sola BD compartida.
 *  - En `beforeEach`, limpiamos las ventas y compras vía DELETE para que cada
 *    test arranque con la BD vacía. Más simple que el caso multi-worker que
 *    necesitaría BDs separadas.
 *  - Los customers NO se limpian: no hay endpoint DELETE /api/customers/:id
 *    (la API no lo expone). Se acumulan entre tests, pero los specs no
 *    asercionan counts de customers, así que no afecta.
 *  - Como `sale_items` tiene `ON DELETE CASCADE`, los items se borran
 *    automáticamente al borrar la venta padre.
 */
import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

/** Re-export del `test` base de Playwright (sin extensiones propias). */
export const test = base;

/** Limpia ventas y compras existentes via la API. Idempotente. */
export async function clearAll(request: APIRequestContext): Promise<void> {
  // Borrar ventas primero (tienen FK a buys y customers; los sale_items
  // se borran en cascada).
  const solds = await request.get('/api/solds?limit=200');
  if (solds.ok()) {
    const body = (await solds.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      const del = await request.delete(`/api/solds/${id}`);
      expect(del.ok(), `DELETE /api/solds/${id} falló: ${del.status()}`).toBe(true);
    }
  }
  // Borrar compras (después de las ventas, porque buys_repo rechaza DELETE
  // si hay sale_items referenciando — pero al borrar las ventas primero,
  // los items ya no existen).
  const buys = await request.get('/api/buys?limit=200');
  if (buys.ok()) {
    const body = (await buys.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      const del = await request.delete(`/api/buys/${id}`);
      expect(del.ok(), `DELETE /api/buys/${id} falló: ${del.status()}`).toBe(true);
    }
  }
  // Customers: se acumulan (no hay endpoint DELETE). No es un problema
  // porque ningún spec asserciona sobre el conteo de customers.
}

/** Navega a `/` (Dashboard) y espera a que termine cualquier loading. */
export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/');
  // Espera a que termine el estado loading (desaparece el spinner).
  await page.waitForFunction(() => !document.body.textContent?.includes('Cargando'), null, {
    timeout: 10_000,
  });
}
