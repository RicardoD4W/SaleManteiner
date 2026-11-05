import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useSolds', () => ({
  useSolds: vi.fn(),
}));

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));

vi.mock('@/components/dashboard/LazyCashFlowChart', () => ({
  LazyCashFlowChart: () => <div data-testid="cashflow-chart-stub" />,
}));

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

import { useSolds } from '@/hooks/useSolds';
import { useCustomers } from '@/hooks/useCustomers';
import { SoldsListPage } from '@/pages/solds/SoldsListPage';
import { renderWithProviders } from '@/test-utils/render';
import { presetRange } from '@/lib/dateRange';

const soldsFixture = [
  {
    id: 1,
    customer_id: 1,
    customerName: 'Juan Pérez',
    sale_price: 100,
    associated_costs: 0,
    paid_amount: 0,
    sold_at: '2026-10-05',
    notes: 'Paga por transferencia',
    created_at: '2026-10-05T10:00:00.000Z',
    profit: 50,
    items: [{ buy_id: 1, product_name: 'Funda', quantity: 1, unit_cost: 50, unit_assoc: 0 }],
  },
  {
    id: 2,
    customer_id: 1,
    customerName: 'Juan Pérez',
    sale_price: 80,
    associated_costs: 0,
    paid_amount: 0,
    sold_at: '2026-10-06',
    notes: null,
    created_at: '2026-10-06T10:00:00.000Z',
    profit: 30,
    items: [{ buy_id: 2, product_name: 'Cargador', quantity: 1, unit_cost: 50, unit_assoc: 0 }],
  },
];

describe('SoldsListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSolds).mockReturnValue({
      data: soldsFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCustomers).mockReturnValue({
      data: [{ id: 1, name: 'Juan Pérez', created_at: '2026-10-01T10:00:00.000Z' }] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('muestra el icono de notas solo en las ventas que tienen notas', () => {
    renderWithProviders(<SoldsListPage />);

    expect(screen.getAllByRole('img', { name: /Notas/ })).toHaveLength(1);
  });

  it('al pasar el ratón por encima del icono se ve la nota entera en un popover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SoldsListPage />);

    await user.hover(screen.getByRole('img', { name: /Notas/ }));

    expect(await screen.findByRole('tooltip')).toHaveTextContent('Paga por transferencia');
  });

  it('al elegir un preset pide las ventas de ese período', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SoldsListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));

    expect(useSolds).toHaveBeenLastCalledWith(presetRange('month'));
  });

  it('"Quitar filtro" deja la lista sin rango', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SoldsListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));
    await user.click(screen.getByRole('button', { name: 'Quitar filtro' }));

    expect(useSolds).toHaveBeenLastCalledWith({});
  });

  it('sin ventas y sin filtro avisa de que no hay ventas todavía', () => {
    vi.mocked(useSolds).mockReturnValue({
      data: [] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<SoldsListPage />);

    expect(screen.getByText('No hay ventas todavía.')).toBeInTheDocument();
  });

  it('sin ventas dentro del período avisa de que el período está vacío', async () => {
    const user = userEvent.setup();
    vi.mocked(useSolds).mockReturnValue({
      data: [] as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<SoldsListPage />);

    await user.click(screen.getByRole('button', { name: 'Este mes' }));

    expect(screen.getByText('No hay ventas en este período.')).toBeInTheDocument();
  });
});
