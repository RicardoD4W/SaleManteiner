import { test as base, expect, type APIRequestContext } from '@playwright/test';

export const test = base;

async function deleteAll(request: APIRequestContext, resource: string): Promise<void> {
  const list = await request.get(`/api/${resource}`);
  expect(list.ok(), `GET /api/${resource} falló: ${list.status()}`).toBe(true);
  const body = (await list.json()) as { data: Array<{ id: number }> };
  for (const { id } of body.data) {
    const del = await request.delete(`/api/${resource}/${id}`);
    expect(del.ok(), `DELETE /api/${resource}/${id} falló: ${del.status()}`).toBe(true);
  }
}

export async function clearAll(request: APIRequestContext): Promise<void> {
  await deleteAll(request, 'solds');
  await deleteAll(request, 'buys');
  await deleteAll(request, 'customers');
}
