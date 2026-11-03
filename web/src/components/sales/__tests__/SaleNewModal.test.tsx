import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCreateSold', () => ({
  useCreateSold: vi.fn(),
}));
vi.mock('@/hooks/useBuysStock', () => ({
  useBuysStock: vi.fn(),
}));
vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));
vi.mock('@/hooks/useCreateCustomer', () => ({
  useCreateCustomer: vi.fn(),
}));

import { useCreateSold } from '@/hooks/useCreateSold';
import { useBuysStock } from '@/hooks/useBuysStock';
import { useCustomers } from '@/hooks/useCustomers';
import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { SaleNewModal } from '@/components/sales/SaleNewModal';
import { renderWithProviders } from '@/test-utils/render';

const mockBuysWithStock = [
  { id: 1, product_name: 'Funda iPhone', quantity: 10, disponibles: 8 },
  { id: 2, product_name: 'Cargador USB-C', quantity: 5, disponibles: 3 },
];

const mockCustomers = [
  {
    id: 1,
    name: 'Juan Pérez',
    phone: null,
    address: null,
    notes: null,
    created_at: '2026-10-01T10:00:00.000Z',
  },
];

function mockHooks() {
  vi.mocked(useBuysStock).mockReturnValue({
    data: mockBuysWithStock as never,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useCustomers).mockReturnValue({
    data: mockCustomers as never,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useCreateCustomer).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
    variables: undefined,
  } as never);
  vi.mocked(useCreateSold).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
    variables: undefined,
  } as never);
}

describe('SaleNewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHooks();
  });

  it('refleja la cantidad final cuando se vuelve a elegir el mismo producto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleNewModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByText('Productos (1)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /\+ Cambiar productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Seleccionar productos')).toBeInTheDocument();
    });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();

    const input = screen.getByLabelText('Cantidad para Funda iPhone');
    fireEvent.change(input, { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(screen.getByText('Productos (1)')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Cantidad para Funda iPhone')).toHaveValue(2);
  });

  it('cancelar el picker vuelve a la modal de venta sin cerrar la venta', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SaleNewModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /\+ Cambiar productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Seleccionar productos')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Cancelar/ }));

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByText('Productos (1)')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('cancelar el picker inicial cancela la venta entera', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SaleNewModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Cancelar/ }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nueva venta')).not.toBeInTheDocument();
  });

  it('Escape con el picker abierto cancela el picker, no la venta', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SaleNewModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /\+ Cambiar productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Seleccionar productos')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByText('Productos (1)')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('el campo Cobrado empieza en 0', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleNewModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Cobrado (€)')).toHaveValue(0);
  });

  it('envía el importe cobrado en el payload de la venta', async () => {
    const user = userEvent.setup();
    const create = { mutateAsync: vi.fn().mockResolvedValue({ id: 1 }) };
    vi.mocked(useCreateSold).mockReturnValue({
      ...create,
      isPending: false,
      isError: false,
      error: null,
      data: null,
      reset: vi.fn(),
      mutate: vi.fn(),
      isSuccess: false,
      isIdle: true,
      status: 'idle',
      failureCount: 0,
      failureReason: null,
      submittedAt: 0,
      context: undefined,
      variables: undefined,
    } as never);

    renderWithProviders(<SaleNewModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });

    await user.type(screen.getByRole('combobox'), 'Juan');
    await user.click(await screen.findByRole('option', { name: 'Juan Pérez' }));

    await user.type(screen.getByLabelText('Precio total de venta (€) *'), '100');
    await user.type(screen.getByLabelText('Cobrado (€)'), '40');
    await user.click(screen.getByRole('button', { name: 'Crear venta' }));

    await waitFor(() => {
      expect(create.mutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({ customer_id: 1, sale_price: 100, paid_amount: 40 }),
      );
    });
  });

  it('el foco inicial de la venta cae en el precio', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleNewModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Precio total de venta (€) *')).toHaveFocus();
  });

  it('cerrar el picker inicial con Escape cancela la venta entera', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SaleNewModal onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Nueva venta')).not.toBeInTheDocument();
  });

  it('al cerrar el picker de productos el foco vuelve al precio', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleNewModal onClose={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /\+ Cambiar productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Seleccionar productos')).toBeInTheDocument();
    });

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    await waitFor(() => {
      expect(screen.getByLabelText('Precio total de venta (€) *')).toHaveFocus();
    });
  });
});
