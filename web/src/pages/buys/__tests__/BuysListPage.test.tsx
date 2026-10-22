/**
 * Tests de la página de listado de compras (BuysListPage).
 *
 * Cubre el cursor de los botones de la fila: el preflight de Tailwind 4 no
 * pone `cursor: pointer` en los `<button>` (en v3 sí lo hacía), así que el
 * puntero salía como flecha en "Borrar" mientras que el link "Editar" sí
 * mostraba la manita.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/hooks/useBuys', () => ({
  useBuys: vi.fn(),
}));

// La tabla es virtualizada: en jsdom el virtualizador no renderiza ninguna
// fila (no hay viewport). Se mockea para que en el test se vean todas.
vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count }: { count: number }) => ({
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        start: index * 44,
        size: 44,
      })),
    getTotalSize: () => count * 44,
    measureElement: () => {},
  }),
}));

import { useBuys } from '@/hooks/useBuys';
import { BuysListPage } from '@/pages/buys/BuysListPage';
import { renderWithProviders } from '@/test-utils/render';

const buysFixture = [
  {
    id: 1,
    product_name: 'Funda iPhone 15',
    purchase_cost: 45.5,
    quantity: 20,
    associated_costs: 3.2,
    purchase_date: '2026-10-02',
    created_at: '2026-10-02T10:00:00.000Z',
    disponibles: 17,
  },
];

describe('BuysListPage', () => {
  beforeEach(() => {
    vi.mocked(useBuys).mockReturnValue({
      data: buysFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('el botón "Borrar" de la fila muestra el cursor de puntero', () => {
    renderWithProviders(<BuysListPage />);

    const borrar = screen.getByRole('button', { name: 'Borrar Funda iPhone 15' });
    expect(borrar.className).toMatch(/cursor-pointer/);
  });
});
