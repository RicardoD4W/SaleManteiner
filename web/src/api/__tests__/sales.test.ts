/**
 * Tests del wrapper `salesApi`. Mockeamos `apiFetch` para verificar
 * que cada método construye la URL/método/body correctos y devuelve
 * `data` (desenvuelve el envelope).
 */
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

// Mock del módulo client (hoisted por Vitest antes de importar salesApi).
vi.mock('../client.js', () => ({
  apiFetch: vi.fn(),
  ApiError: class ApiError extends Error {},
}));

import { apiFetch } from '../client.js';
import { salesApi } from '../sales.js';
import { CreateSaleInput, UpdateSaleInput } from '../../schemas/sales.js';
import { saleFixture, statsFixture } from '../../test-utils/fixtures.js';

const apiFetchMock = apiFetch as unknown as Mock;

describe('salesApi', () => {
  beforeEach(() => {
    apiFetchMock.mockReset();
  });

  describe('list', () => {
    it('llama a /api/sales sin querystring cuando no hay filtros', async () => {
      apiFetchMock.mockResolvedValueOnce({ data: [saleFixture] });
      const result = await salesApi.list();

      expect(apiFetchMock).toHaveBeenCalledTimes(1);
      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales');
      expect(result).toEqual([saleFixture]);
    });

    it('construye querystring con sold, limit y offset', async () => {
      apiFetchMock.mockResolvedValueOnce({ data: [] });
      await salesApi.list({ sold: true, limit: 10, offset: 20 });

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales?sold=true&limit=10&offset=20');
    });

    it('acepta filtros parciales (solo sold)', async () => {
      apiFetchMock.mockResolvedValueOnce({ data: [] });
      await salesApi.list({ sold: false });

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales?sold=false');
    });

    it('acepta filtros parciales (solo limit)', async () => {
      apiFetchMock.mockResolvedValueOnce({ data: [] });
      await salesApi.list({ limit: 5 });

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales?limit=5');
    });
  });

  describe('getById', () => {
    it('llama a /api/sales/:id', async () => {
      apiFetchMock.mockResolvedValueOnce({ data: saleFixture });
      const result = await salesApi.getById(5);

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales/5');
      expect(result).toEqual(saleFixture);
    });
  });

  describe('create', () => {
    it('hace POST a /api/sales con body', async () => {
      // Construimos el input parseando el schema para aplicar branded types.
      const input = CreateSaleInput.parse({
        product_name: 'X',
        cost_cents: 1000,
        price_cents: 2500,
        associated_costs_cents: 0,
        sold: false,
      });
      apiFetchMock.mockResolvedValueOnce({ data: saleFixture });
      const result = await salesApi.create(input);

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales', {
        method: 'POST',
        body: input,
      });
      expect(result).toEqual(saleFixture);
    });
  });

  describe('update', () => {
    it('hace PATCH a /api/sales/:id con body', async () => {
      const input = UpdateSaleInput.parse({ price_cents: 30000, sold: true });
      apiFetchMock.mockResolvedValueOnce({ data: saleFixture });
      const result = await salesApi.update(7, input);

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales/7', {
        method: 'PATCH',
        body: input,
      });
      expect(result).toEqual(saleFixture);
    });
  });

  describe('remove', () => {
    it('hace DELETE a /api/sales/:id y devuelve undefined', async () => {
      apiFetchMock.mockResolvedValueOnce(undefined);
      const result = await salesApi.remove(3);

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales/3', { method: 'DELETE' });
      expect(result).toBeUndefined();
    });
  });

  describe('stats', () => {
    it('llama a /api/sales/stats y devuelve data', async () => {
      apiFetchMock.mockResolvedValueOnce({ data: statsFixture });
      const result = await salesApi.stats();

      expect(apiFetchMock).toHaveBeenCalledWith('/api/sales/stats');
      expect(result).toEqual(statsFixture);
    });
  });
});