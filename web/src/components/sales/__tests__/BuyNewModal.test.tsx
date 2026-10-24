import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCreateBuy', () => ({
  useCreateBuy: vi.fn(),
}));

import { useCreateBuy } from '@/hooks/useCreateBuy';
import { BuyNewModal } from '@/components/sales/BuyNewModal';
import { renderWithProviders } from '@/test-utils/render';

function mutationMock(overrides: Record<string, unknown> = {}) {
  return {
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
    ...overrides,
  };
}

describe('BuyNewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateBuy).mockReturnValue(mutationMock() as never);
  });

  it('el foco inicial va al primer input y el focus trap no deja salir', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuyNewModal onClose={vi.fn()} />);

    const dialog = screen.getByRole('dialog');
    expect(screen.getByLabelText('Producto *')).toHaveFocus();

    await user.tab();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
  });

  it('Escape cierra la modal', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<BuyNewModal onClose={onClose} />);

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('un producto de solo espacios no llega al servidor', async () => {
    const user = userEvent.setup();
    const create = mutationMock();
    vi.mocked(useCreateBuy).mockReturnValue(create as never);

    renderWithProviders(<BuyNewModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Producto *'), '   ');
    await user.click(screen.getByRole('button', { name: 'Crear compra' }));

    expect(await screen.findByText('El producto es obligatorio')).toBeInTheDocument();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('un coste con más de 2 decimales no llega al servidor', async () => {
    const user = userEvent.setup();
    const create = mutationMock();
    vi.mocked(useCreateBuy).mockReturnValue(create as never);

    renderWithProviders(<BuyNewModal onClose={vi.fn()} />);

    await user.type(screen.getByLabelText('Producto *'), 'Funda iPhone 15');
    fireEvent.change(screen.getByLabelText('Coste (€) *'), { target: { value: '10.005' } });
    await user.click(screen.getByRole('button', { name: 'Crear compra' }));

    expect(await screen.findByText('Máximo 2 decimales')).toBeInTheDocument();
    expect(create.mutateAsync).not.toHaveBeenCalled();
  });

  it('guarda la compra y manda la fecha vacía como undefined', async () => {
    const user = userEvent.setup();
    const create = mutationMock({
      mutateAsync: vi.fn().mockResolvedValueOnce({ id: 1 }),
    });
    vi.mocked(useCreateBuy).mockReturnValue(create as never);
    const onClose = vi.fn();

    renderWithProviders(<BuyNewModal onClose={onClose} />);

    await user.type(screen.getByLabelText('Producto *'), 'Funda iPhone 15');
    fireEvent.change(screen.getByLabelText('Coste (€) *'), { target: { value: '45.5' } });
    fireEvent.change(screen.getByLabelText('Fecha de compra'), { target: { value: '' } });
    await user.click(screen.getByRole('button', { name: 'Crear compra' }));

    await waitFor(() => {
      expect(create.mutateAsync).toHaveBeenCalledWith({
        product_name: 'Funda iPhone 15',
        purchase_cost: 45.5,
        quantity: 1,
        associated_costs: 0,
        purchase_date: undefined,
      });
    });
    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
  });
});
