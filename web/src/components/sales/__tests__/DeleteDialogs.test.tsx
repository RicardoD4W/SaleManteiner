import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useDeleteBuy', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/hooks/useDeleteBuy')>();
  return { ...actual, useDeleteBuy: vi.fn() };
});
vi.mock('@/hooks/useDeleteBuyCascade', () => ({ useDeleteBuyCascade: vi.fn() }));
vi.mock('@/hooks/useDeleteSold', () => ({ useDeleteSold: vi.fn() }));

import { useDeleteBuy, type AssociatedSale } from '@/hooks/useDeleteBuy';
import { useDeleteBuyCascade } from '@/hooks/useDeleteBuyCascade';
import { useDeleteSold } from '@/hooks/useDeleteSold';
import { DeleteDialogs } from '@/components/sales/DeleteDialogs';
import { ApiError } from '@/api/client';
import { renderWithProviders } from '@/test-utils/render';

const SALES: AssociatedSale[] = [
  { id: 7, customer_name: 'Cliente Cascade', sold_at: '2026-10-21', items_count: 2 },
];

function error409(): ApiError {
  const body = {
    error: 'No se puede borrar: la compra tiene ventas asociadas.',
    associated_sales: SALES,
  };
  return new ApiError(409, body);
}

describe('DeleteDialogs', () => {
  const deleteBuyMutate = vi.fn();
  const deleteCascadeMutate = vi.fn();
  const deleteSoldMutate = vi.fn();

  beforeEach(() => {
    deleteBuyMutate.mockReset();
    deleteCascadeMutate.mockReset();
    deleteSoldMutate.mockReset();

    vi.mocked(useDeleteBuy).mockReturnValue({
      mutateAsync: deleteBuyMutate,
      isPending: false,
    } as never);
    vi.mocked(useDeleteBuyCascade).mockReturnValue({
      mutateAsync: deleteCascadeMutate,
      isPending: false,
    } as never);
    vi.mocked(useDeleteSold).mockReturnValue({
      mutateAsync: deleteSoldMutate,
      isPending: false,
    } as never);
  });

  it('no renderiza nada si no hay objetivo', () => {
    renderWithProviders(<DeleteDialogs target={null} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('compra sin ventas: confirma y borra', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    deleteBuyMutate.mockResolvedValue(undefined);

    renderWithProviders(
      <DeleteDialogs target={{ kind: 'buy', id: 3, name: 'Funda iPhone' }} onClose={onClose} />,
    );

    expect(screen.getByText('"Funda iPhone"')).toBeInTheDocument();
    expect(screen.getByText(/No se puede deshacer/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(deleteBuyMutate).toHaveBeenCalledWith(3);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(deleteCascadeMutate).not.toHaveBeenCalled();
  });

  it('compra con ventas: el 409 abre la modal de cascada y borra en cascada', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    deleteBuyMutate.mockRejectedValue(error409());
    deleteCascadeMutate.mockResolvedValue(undefined);

    renderWithProviders(
      <DeleteDialogs target={{ kind: 'buy', id: 3, name: 'Funda iPhone' }} onClose={onClose} />,
    );

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(screen.getByText('La compra tiene ventas asociadas')).toBeInTheDocument();
    });
    expect(screen.getByText('Venta #7')).toBeInTheDocument();
    expect(screen.getByText(/Cliente Cascade/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Borrar también las ventas y la compra' }));

    await waitFor(() => {
      expect(deleteCascadeMutate).toHaveBeenCalledWith(3);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  it('venta: confirma y borra', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    deleteSoldMutate.mockResolvedValue(undefined);

    renderWithProviders(<DeleteDialogs target={{ kind: 'sale', id: 12 }} onClose={onClose} />);

    expect(screen.getByText('¿Eliminar esta venta? No se puede deshacer.')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(deleteSoldMutate).toHaveBeenCalledWith(12);
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalledTimes(1);
    });
    expect(deleteBuyMutate).not.toHaveBeenCalled();
    expect(deleteCascadeMutate).not.toHaveBeenCalled();
  });

  it('si el borrado simple falla, el error se muestra dentro de la modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    deleteBuyMutate.mockRejectedValue(new ApiError(0, { error: 'Error de red' }));

    renderWithProviders(
      <DeleteDialogs target={{ kind: 'buy', id: 3, name: 'Funda iPhone' }} onClose={onClose} />,
    );

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error de red');
    });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('si el cascade falla, el error se muestra dentro de la modal de cascada', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    deleteBuyMutate.mockRejectedValue(error409());
    deleteCascadeMutate.mockRejectedValue(new ApiError(0, { error: 'Error de red' }));

    renderWithProviders(
      <DeleteDialogs target={{ kind: 'buy', id: 3, name: 'Funda iPhone' }} onClose={onClose} />,
    );

    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => {
      expect(screen.getByText('La compra tiene ventas asociadas')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Borrar también las ventas y la compra' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Error de red');
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});
