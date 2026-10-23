import { test as base, expect, type APIRequestContext, type Page } from '@playwright/test';

export const test = base;

export async function clearAll(request: APIRequestContext): Promise<void> {
  const solds = await request.get('/api/solds?limit=200');
  if (solds.ok()) {
    const body = (await solds.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      const del = await request.delete(`/api/solds/${id}`);
      expect(del.ok(), `DELETE /api/solds/${id} falló: ${del.status()}`).toBe(true);
    }
  }
  const buys = await request.get('/api/buys?limit=200');
  if (buys.ok()) {
    const body = (await buys.json()) as { data: Array<{ id: number }> };
    for (const { id } of body.data) {
      const del = await request.delete(`/api/buys/${id}`);
      expect(del.ok(), `DELETE /api/buys/${id} falló: ${del.status()}`).toBe(true);
    }
  }
}

export async function gotoHome(page: Page): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => !document.body.textContent?.includes('Cargando'), null, {
    timeout: 10_000,
  });
}
