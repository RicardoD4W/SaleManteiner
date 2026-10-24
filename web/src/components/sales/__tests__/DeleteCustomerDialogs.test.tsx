import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useDeleteCustomer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useDeleteCustomer')>();
  return {
    ...actual,
    useDeleteCustomer: vi.fn(),
    useDeleteCustomerCascade: vi.fn(),
  };
});

import { useDeleteCustomer, useDeleteCustomerCascade } from '@/hooks/useDeleteCustomer';
import type { AssociatedSale } from '@/api/types';
import { DeleteCustomerDialogs } from '@/components/sales/DeleteCustomerDialogs';
import { ApiError } from '@/api/client';
import { renderWithProviders } from '@/test-utils/render';

const SALES: AssociatedSale[] = [
  { id: 7, customer_name: 'Cliente Cascade', sold_at: '2026-10-21', items_count: 2 },
];

const customerFixture = {
  id: 3,
  name: 'Ana García',
  created_at: '2026-10-01T10:00:00.000Z',
};

function error409(): ApiError {
  const body = {
    error: 'No se puede borrar: el cliente tiene ventas asociadas.',
    associated_sales: SALES,
  };
  return new ApiError(409, body);
}

describe('DeleteCustomerDialogs', () => {
  const deleteMutate = vi.fn();
  const deleteCascadeMutate = vi.fn();

  beforeEach(() => {
    deleteMutate.mockReset();
    deleteCascadeMutate.mockReset();

    vi.mocked(useDeleteCustomer).mockReturnValue({
      mutateAsync: deleteMutate,
      isPending: false,
    } as never);
    vi.mocked(useDeleteCustomerCascade).mockReturnValue({
      mutateAsync: deleteCascadeMutate,
      isPending: false,
    } as never);
  });

  it('no renderiza nada si no hay cliente', () => {
    renderWithProviders(<DeleteCustomerDialogs customer={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('cliente sin ventas: confirma y borra', async () => {
    const user = userEvent.setup();
    deleteMutate.mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderWithProviders(<DeleteCustomerDialogs customer={customerFixture} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(deleteMutate).toHaveBeenCalledWith(customerFixture.id);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('cliente con ventas: el 409 abre la modal de cascada y borra en cascada', async () => {
    const user = userEvent.setup();
    deleteMutate.mockRejectedValue(error409());
    deleteCascadeMutate.mockResolvedValue(undefined);
    const onClose = vi.fn();

    renderWithProviders(<DeleteCustomerDialogs customer={customerFixture} onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    const cascadeDialog = await screen.findByRole('dialog');
    expect(cascadeDialog).toHaveTextContent('El cliente tiene ventas asociadas');
    expect(cascadeDialog).toHaveTextContent('Cliente Cascade');

    await user.click(
      screen.getByRole('button', { name: 'Borrar también las ventas y el cliente' }),
    );

    await waitFor(() => {
      expect(deleteCascadeMutate).toHaveBeenCalledWith(customerFixture.id);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });

  it('si el borrado falla, el error se muestra dentro de la modal', async () => {
    const user = userEvent.setup();
    deleteMutate.mockRejectedValue(new ApiError(500, { error: 'Se rompió' }));

    renderWithProviders(<DeleteCustomerDialogs customer={customerFixture} onClose={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Se rompió');
  });
});
