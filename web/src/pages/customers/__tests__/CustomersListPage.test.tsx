import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));
vi.mock('@/hooks/useDeleteCustomer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useDeleteCustomer')>();
  return { ...actual, useDeleteCustomer: vi.fn(), useDeleteCustomerCascade: vi.fn() };
});
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
import { useDeleteCustomer, useDeleteCustomerCascade } from '@/hooks/useDeleteCustomer';
import { CustomersListPage } from '@/pages/customers/CustomersListPage';
import { ApiError } from '@/api/client';
import { renderWithProviders } from '@/test-utils/render';

const customersFixture = [
  {
    id: 1,
    name: 'Juan Pérez',
    phone: '612345678',
    address: 'Calle Mayor 1',
    notes: 'Paga al contado',
    created_at: '2026-09-01T10:00:00.000Z',
    ventas: 2,
    total_gastado: 100,
    deuda: 25,
  },
  {
    id: 2,
    name: 'Ana García',
    phone: null,
    address: null,
    notes: null,
    created_at: '2026-09-02T10:00:00.000Z',
    ventas: 1,
    total_gastado: 25.5,
    deuda: 0,
  },
];

function error409(): ApiError {
  const body = {
    error:
      'No se puede borrar: el cliente tiene ventas asociadas. ¿Querés borrar también las ventas?',
    associated_sales: [
      { id: 7, customer_name: 'Juan Pérez', sold_at: '2026-10-21', items_count: 2 },
    ],
  };
  return new ApiError(409, body);
}

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
    vi.mocked(useDeleteCustomer).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as never);
    vi.mocked(useDeleteCustomerCascade).mockReturnValue({
      mutateAsync: vi.fn().mockResolvedValue(undefined),
      isPending: false,
    } as never);
  });

  it('lista los clientes con su número de ventas y su total gastado', () => {
    renderWithProviders(<CustomersListPage />);

    expect(screen.getByRole('heading', { name: 'Clientes' })).toBeInTheDocument();
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    expect(screen.getByText('Ana García')).toBeInTheDocument();

    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    expect(juanRow).toHaveTextContent('2');
    expect(juanRow).toHaveTextContent('100,00 €');

    const anaRow = screen.getByText('Ana García').closest('tr');
    expect(anaRow).toHaveTextContent('1');
    expect(anaRow).toHaveTextContent('25,50 €');
  });

  it('muestra el teléfono formateado en grupos de tres', () => {
    renderWithProviders(<CustomersListPage />);

    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    expect(juanRow).toHaveTextContent('612 345 678');
  });

  it('muestra la dirección de cada cliente', () => {
    renderWithProviders(<CustomersListPage />);

    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    expect(juanRow).toHaveTextContent('Calle Mayor 1');
  });

  it('muestra el icono de notas solo en los clientes que tienen notas', () => {
    renderWithProviders(<CustomersListPage />);

    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    expect(within(juanRow as HTMLElement).getByRole('img', { name: /Notas/ })).toBeInTheDocument();

    const anaRow = screen.getByText('Ana García').closest('tr');
    expect(within(anaRow as HTMLElement).queryByRole('img', { name: /Notas/ })).toBeNull();
  });

  it('al pasar el ratón por encima del icono se ve la nota entera en un popover', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersListPage />);

    const juanRow = screen.getByText('Juan Pérez').closest('tr') as HTMLElement;
    const icon = within(juanRow).getByRole('img', { name: /Notas/ });

    await user.hover(icon);

    const tooltip = await screen.findByRole('tooltip');
    expect(tooltip).toHaveTextContent('Paga al contado');
  });

  it('muestra la deuda en euros', () => {
    renderWithProviders(<CustomersListPage />);

    const juanRow = screen.getByText('Juan Pérez').closest('tr');
    expect(juanRow).toHaveTextContent('25,00 €');

    const anaRow = screen.getByText('Ana García').closest('tr');
    expect(anaRow).toHaveTextContent('0,00 €');
  });

  it('las notas son la última columna de datos, antes de la de acciones', () => {
    renderWithProviders(<CustomersListPage />);

    const headers = screen
      .getAllByRole('columnheader')
      .map((th) => th.textContent?.trim().replace(/[▲▼]/g, '') ?? '');

    expect(headers).toEqual([
      'Cliente',
      'Teléfono',
      'Dirección',
      'Ventas',
      'Total gastado',
      'Deuda',
      'Notas',
      '',
    ]);
  });

  it('la tabla se puede desplazar en horizontal en móvil', () => {
    renderWithProviders(<CustomersListPage />);

    const scroller = screen.getByRole('table').parentElement;
    expect(scroller?.className).toMatch(/overflow-x-auto/);
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

  it('el botón "Borrar" abre la confirmación del borrado', async () => {
    const user = userEvent.setup();
    renderWithProviders(<CustomersListPage />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Borrar Juan Pérez' }));

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('"Juan Pérez"')).toBeInTheDocument();
    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument();
  });

  it('los botones de la fila muestran el cursor de puntero', () => {
    renderWithProviders(<CustomersListPage />);

    expect(screen.getByRole('button', { name: 'Editar Juan Pérez' }).className).toMatch(
      /cursor-pointer/,
    );
    expect(screen.getByRole('button', { name: 'Borrar Juan Pérez' }).className).toMatch(
      /cursor-pointer/,
    );
  });

  it('un cliente sin ventas se borra con el DELETE simple', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteCustomer).mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithProviders(<CustomersListPage />);

    await user.click(screen.getByRole('button', { name: 'Borrar Juan Pérez' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(mutateAsync).toHaveBeenCalledWith(1);
    });
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
  });

  it('un cliente con ventas: el 409 abre la modal de cascada y borra en cascada', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(error409());
    const mutateCascadeAsync = vi.fn().mockResolvedValue(undefined);
    vi.mocked(useDeleteCustomer).mockReturnValue({ mutateAsync, isPending: false } as never);
    vi.mocked(useDeleteCustomerCascade).mockReturnValue({
      mutateAsync: mutateCascadeAsync,
      isPending: false,
    } as never);

    renderWithProviders(<CustomersListPage />);

    await user.click(screen.getByRole('button', { name: 'Borrar Juan Pérez' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(screen.getByText('El cliente tiene ventas asociadas')).toBeInTheDocument();
    });
    expect(screen.getByText('Venta #7')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Borrar también las ventas y el cliente' }),
    );

    await waitFor(() => {
      expect(mutateCascadeAsync).toHaveBeenCalledWith(1);
    });
  });

  it('centra las columnas de iconos: Notas y acciones', () => {
    renderWithProviders(<CustomersListPage />);

    const notasHeader = screen.getByRole('columnheader', { name: 'Notas' });
    expect(notasHeader).toHaveClass('text-center');
    expect(screen.getByRole('img', { name: 'Notas: Paga al contado' }).closest('td')).toHaveClass(
      'text-center',
    );
    expect(screen.getByRole('button', { name: 'Editar Juan Pérez' }).closest('td')).toHaveClass(
      'text-center',
    );
  });

  it('si el borrado simple falla, el error se muestra dentro de la modal', async () => {
    const user = userEvent.setup();
    const mutateAsync = vi.fn().mockRejectedValue(new ApiError(0, { error: 'Error de red' }));
    vi.mocked(useDeleteCustomer).mockReturnValue({ mutateAsync, isPending: false } as never);

    renderWithProviders(<CustomersListPage />);

    await user.click(screen.getByRole('button', { name: 'Borrar Juan Pérez' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error de red');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('las filas entran con la animación de entrada', () => {
    renderWithProviders(<CustomersListPage />);

    expect(screen.getByText('Juan Pérez').closest('tr')).toHaveClass('animate-row-slide-in');
    expect(screen.getByText('Ana García').closest('tr')).toHaveClass('animate-row-slide-in');
  });

  it('la fila que desaparece sale con la animación de salida y se retira al terminar', async () => {
    vi.useFakeTimers();

    try {
      const { rerender } = renderWithProviders(<CustomersListPage />);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      vi.mocked(useCustomers).mockReturnValue({
        data: [customersFixture[0]] as never,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn(),
      } as never);

      rerender(<CustomersListPage />);

      expect(screen.getByText('Ana García').closest('tr')).toHaveClass('animate-row-slide-out');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(240);
      });

      expect(screen.queryByText('Ana García')).toBeNull();
      expect(screen.getByText('Juan Pérez').closest('tr')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
