/**
 * Fixtures reutilizables para tests. Datos "realistas" (no placeholders
 * tipo "test") para que los snapshots visuales y aserciones tengan sentido.
 *
 * Se construyen con `Sale.parse(...)` para que el branded type (`Cents`,
 * `RowId`, `ISODateTime`) se aplique correctamente — los números literales
 * no son aceptados por TS strict sin el cast que hace Zod al parsear.
 */
import { z } from 'zod';
import { Sale } from '../schemas/sales.js';
import type { SaleStats } from '../api/sales.js';

// Tipo del input crudo (lo que llega del backend antes del branded parse).
type SaleInput = z.input<typeof Sale>;

export const saleFixture: Sale = Sale.parse({
  id: 1,
  product_name: 'iPhone 12 64GB',
  buyer_name: 'Juan Pérez',
  cost_cents: 15000,
  price_cents: 25000,
  associated_costs_cents: 500,
  sold: true,
  notes: 'En caja original',
  purchase_date: '2026-09-28',
  created_at: '2026-10-01T10:00:00.000Z',
  sold_at: '2026-10-05T14:30:00.000Z',
});

export const pendingSaleFixture: Sale = Sale.parse({
  id: 2,
  product_name: 'Libro TypeScript',
  buyer_name: null,
  cost_cents: 1200,
  price_cents: 2500,
  associated_costs_cents: 0,
  sold: false,
  notes: null,
  purchase_date: null,
  created_at: '2026-10-10T09:00:00.000Z',
  sold_at: null,
});

// Helper para tests que quieren una `SaleInput` (lo que devuelve el backend
// crudo, antes del parse). Útil para mocks de API.
export function saleInputFixture(overrides: Partial<SaleInput> = {}): SaleInput {
  return {
    id: 1,
    product_name: 'iPhone 12 64GB',
    buyer_name: 'Juan Pérez',
    cost_cents: 15000,
    price_cents: 25000,
    associated_costs_cents: 500,
    sold: true,
    notes: 'En caja original',
    purchase_date: '2026-09-28',
    created_at: '2026-10-01T10:00:00.000Z',
    sold_at: '2026-10-05T14:30:00.000Z',
    ...overrides,
  };
}

export const statsFixture: SaleStats = {
  total: 2,
  sold: 1,
  not_sold: 1,
  revenue_cents: 25000,
  cost_cents: 16200,
  associated_costs_cents: 500,
  net_profit_cents: 8300,
};

export const emptyStatsFixture: SaleStats = {
  total: 0,
  sold: 0,
  not_sold: 0,
  revenue_cents: 0,
  cost_cents: 0,
  associated_costs_cents: 0,
  net_profit_cents: 0,
};