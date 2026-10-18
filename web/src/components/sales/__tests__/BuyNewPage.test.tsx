/**
 * Tests del componente BuyNewPage.
 *
 * Verifica:
 *  - El form se renderiza con los campos correctos.
 *  - Submit llama a useCreateBuy.mutateAsync con el payload correcto.
 *  - Validación: campos obligatorios.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCreateBuy', () => ({
  useCreateBuy: vi.fn(),
}));

import { useCreateBuy } from '@/hooks/useCreateBuy';
import { BuyNewPage } from '@/pages/buys/BuyNewPage';
import { renderWithProviders } from '@/test-utils/render';
import type { Mock } from 'vitest';

function makeMutationResult(mutateAsync: Mock) {
  return {
    mutateAsync,
    mutate: mutateAsync,
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle' as const,
    data: undefined,
    error: null,
    reset: vi.fn(),
    variables: undefined,
    failureCount: 0,
    failureReason: null,
    context: undefined,
    submittedAt: 0,
  };
}

describe('BuyNewPage', () => {
  beforeEach(() => {
    vi.mocked(useCreateBuy).mockReturnValue(
      makeMutationResult(vi.fn().mockResolvedValue({
        id: 1,
        product_name: 'Funda iPhone',
        purchase_cost: 50,
        quantity: 10,
        associated_costs: 5,
        purchase_date: '2026-10-01',
        created_at: '2026-10-01T10:00:00.000Z',
      })) as never,
    );
  });

  it('renderiza el form con campos requeridos', () => {
    renderWithProviders(<BuyNewPage />, { route: '/buys/new' });

    expect(screen.getByLabelText('Producto *')).toBeInTheDocument();
    expect(screen.getByLabelText('Coste (€) *')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad *')).toBeInTheDocument();
    expect(screen.getByLabelText('Fecha de compra')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Crear compra/ })).toBeInTheDocument();
  });

  it('submit llama a create.mutateAsync con euros decimales (no céntimos)', async () => {
    const user = userEvent.setup();
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: 1,
      product_name: 'Funda iPhone',
      purchase_cost: 50,
      quantity: 10,
      associated_costs: 5,
      purchase_date: '2026-10-01',
      created_at: '2026-10-01T10:00:00.000Z',
    });
    vi.mocked(useCreateBuy).mockReturnValue(makeMutationResult(createMutateAsync) as never);

    renderWithProviders(<BuyNewPage />, { route: '/buys/new' });

    await user.type(screen.getByLabelText('Producto *'), 'Funda iPhone');
    await user.clear(screen.getByLabelText('Coste (€) *'));
    await user.type(screen.getByLabelText('Coste (€) *'), '50');
    await user.clear(screen.getByLabelText('Cantidad *'));
    await user.type(screen.getByLabelText('Cantidad *'), '10');

    await user.click(screen.getByRole('button', { name: /Crear compra/ }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = createMutateAsync.mock.calls[0]?.[0];
    // El payload usa euros decimales directo, no céntimos.
    expect(payload.product_name).toBe('Funda iPhone');
    expect(payload.purchase_cost).toBe(50);
    expect(payload.quantity).toBe(10);
  });

  it('campos vacíos disparan mensaje de error', async () => {
    const user = userEvent.setup();
    renderWithProviders(<BuyNewPage />, { route: '/buys/new' });

    // Submit sin tocar nada.
    await user.click(screen.getByRole('button', { name: /Crear compra/ }));

    await waitFor(() => {
      expect(screen.getByText('El producto es obligatorio')).toBeInTheDocument();
    });
  });

  it('asociados y fecha tienen defaults correctos', async () => {
    const user = userEvent.setup();
    const createMutateAsync = vi.fn().mockResolvedValue({
      id: 1,
      product_name: 'X',
      purchase_cost: 0,
      quantity: 1,
      associated_costs: 0,
      purchase_date: null,
      created_at: '2026-10-01T10:00:00.000Z',
    });
    vi.mocked(useCreateBuy).mockReturnValue(makeMutationResult(createMutateAsync) as never);

    renderWithProviders(<BuyNewPage />, { route: '/buys/new' });

    await user.type(screen.getByLabelText('Producto *'), 'X');
    await user.click(screen.getByRole('button', { name: /Crear compra/ }));

    await waitFor(() => {
      expect(createMutateAsync).toHaveBeenCalledTimes(1);
    });

    const payload = createMutateAsync.mock.calls[0]?.[0];
    expect(payload.associated_costs).toBe(0);
    expect(payload.purchase_date).toBeDefined();
  });
});
