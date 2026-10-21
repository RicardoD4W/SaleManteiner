/**
 * Tests de la vista de Clientes (CustomersListPage).
 *
 * Cubre:
 *  - La lista de clientes con su número de ventas y su total gastado.
 *  - Los estados de carga y de error (con "Reintentar").
 *  - El botón "Nuevo cliente" abre el modal de alta.
 *  - El botón "Editar" abre el modal de edición con el cliente.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));
vi.mock('@/hooks/useSolds', () => ({
  useSolds: vi.fn(),
}));
vi.mock('@/components/sales/CustomerFormModal', () => ({
  CustomerFormModal: ({
    mode,
    customer,
  }: {
    mode: string;
    customer?: { id: number; name: string };
  }) => (
    <div role="dialog" aria-label="CustomerFormModal">
      <span data-testid="modal-mode">{mode}</span>
      <span data-testid="modal-customer">{customer ? customer.name : ''}</span>
    </div>
  ),
}));

import { useCustomers } from '@/hooks/useCustomers';
import { useSolds } from '@/hooks/useSolds';
import { CustomersListPage } from '@/pages/customers/CustomersListPage';
import { renderWithProviders } from '@/test-utils/render';

const customersFixture = [
  { id: 1, name: 'Juan Pérez', created_at: '2026-09-01T10:00:00.000Z' },
  { id: 2, name: 'Ana García', created_at: '2026-09-02T10:00:00.000Z' },
];

const soldsFixture = [
  {
    id: 1,
    customer_id: 1,
    sale_price: 40.0,
    associated_costs: 2.0,
    sold_at: '2026-10-05',
    notes: null,
    created_at: '2026-10-05T14:30:00.000Z',
    profit: 10,
    items: [],
  },
  {
    id: 2,
    customer_id: 1,
    sale_price: 60.0,
    associated_costs: 0,
    sold_at: '2026-10-06',
    notes: null,
    created_at: '2026-10-06T14:30:00.000Z',
    profit: 20,
    items: [],
  },
  {
    id: 3,
    customer_id: 2,
    sale_price: 25.5,
    associated_costs: 0,
    sold_at: '2026-10-07',
    notes: null,
    created_at: '2026-10-07T14:30:00.000Z',
    profit: 5,
    items: [],
  },
];

describe('CustomersListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCustomers).mockReturnValue({
      data: customersFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useSolds).mockReturnValue({
      data: soldsFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('lista los clientes con su número de ventas y su total gastado', () => {
    renderWithProviders(<CustomersListPage />);

    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument();

    // Juan Pérez: 2 ventas, 40 + 60 = 100 €.
    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    expect(juanRow).toHaveTextContent('2');
    expect(juanRow).toHaveTextContent('100,00 €');

    // Ana García: 1 venta, 25,50 €.
    const anaRow = screen.getByText('Ana García').closest('tr');
    expect(anaRow).toHaveTextContent('1');
    expect(anaRow).toHaveTextContent('25,50 €');
  });

  it('muestra el estado de carga', () => {
    vi.mocked(useCustomers).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<CustomersListPage />);

    expect(screen.getByText(/Cargando clientes/)).toBeInTheDocument();
  });

  it('muestra el estado de error con un botón "Reintentar"', () => {
    vi.mocked(useCustomers).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('boom'),
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<CustomersListPage />);

    expect(screen.getByText(/No se pudieron cargar los clientes/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
  });

  it('el botón "Nuevo cliente" abre el modal de alta', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersListPage />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Nuevo cliente/ }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('modal-mode')).toHaveTextContent('create');
  });

  it('el botón "Editar" abre el modal de edición con el cliente', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersListPage />);

    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    const editButton = juanRow?.querySelector('button');
    expect(editButton).toBeTruthy();

    await user.click(editButton as HTMLButtonElement);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByTestId('modal-mode')).toHaveTextContent('edit');
    expect(screen.getByTestId('modal-customer')).toHaveTextContent('Juan Pérez');
  });
});
