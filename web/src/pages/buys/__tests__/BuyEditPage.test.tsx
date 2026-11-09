import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useBuy', () => ({
  useBuy: vi.fn(),
}));

vi.mock('@/hooks/useUpdateBuy', () => ({
  useUpdateBuy: vi.fn(),
}));

vi.mock('@/hooks/useProductNames', () => ({
  useProductNames: vi.fn(),
}));

import { useBuy } from '@/hooks/useBuy';
import { useUpdateBuy } from '@/hooks/useUpdateBuy';
import { useProductNames } from '@/hooks/useProductNames';
import type { Buy } from '@/schemas/buys';
import { BuyEditPage } from '@/pages/buys/BuyEditPage';
import { renderWithProviders } from '@/test-utils/render';

const buyFixture: Buy = {
  id: 1,
  product_name: 'Funda iPhone 15',
  purchase_cost: 45.5,
  quantity: 20,
  total_cost: 910,
  associated_costs: 3.2,
  purchase_date: '2026-10-02',
  notes: null,
  created_at: '2026-10-02T10:00:00.000Z',
};

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

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/buys/:id" element={<BuyEditPage />} />
    </Routes>,
    { route: '/buys/1' },
  );
}

describe('BuyEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useBuy).mockReturnValue({
      data: buyFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useUpdateBuy).mockReturnValue(mutationMock() as never);
    vi.mocked(useProductNames).mockReturnValue({
      data: [
        { name: 'Funda iPhone 15', uses: 3 },
        { name: 'Funda iPhone 16', uses: 1 },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('no enfoca ningún campo al abrir el formulario', async () => {
    renderPage();

    await screen.findByLabelText('Precio unidad (€) *');

    expect(document.activeElement).toBe(document.body);
    expect(screen.getByRole('combobox')).not.toHaveFocus();
    expect(screen.getByLabelText('Precio unidad (€) *')).not.toHaveFocus();
    expect(screen.getByLabelText('Cantidad *')).not.toHaveFocus();
  });

  it('muestra el total del lote derivado del precio unidad y la cantidad', async () => {
    renderPage();

    await screen.findByLabelText('Precio unidad (€) *');

    expect(screen.getByText('Total del lote:')).toBeInTheDocument();
    expect(screen.getByText('910,00 €')).toBeInTheDocument();
  });

  it('el total del lote se recalcula al cambiar el precio unidad', async () => {
    renderPage();

    await screen.findByLabelText('Precio unidad (€) *');

    fireEvent.change(screen.getByLabelText('Precio unidad (€) *'), { target: { value: '7.5' } });

    await waitFor(() => expect(screen.getByText('150,00 €')).toBeInTheDocument());
  });

  it('valida el producto con las mismas reglas que el alta', async () => {
    const user = userEvent.setup();
    const update = mutationMock();
    vi.mocked(useUpdateBuy).mockReturnValue(update as never);

    renderPage();

    const productInput = await screen.findByLabelText('Producto *');
    await user.clear(productInput);
    await user.type(productInput, '   ');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    expect(await screen.findByText('El producto es obligatorio')).toBeInTheDocument();
    expect(update.mutateAsync).not.toHaveBeenCalled();
  });

  it('ofrece los nombres de producto existentes y guarda el elegido', async () => {
    const user = userEvent.setup();
    const update = mutationMock({
      mutateAsync: vi.fn().mockResolvedValueOnce(buyFixture),
    });
    vi.mocked(useUpdateBuy).mockReturnValue(update as never);

    renderPage();

    const productInput = await screen.findByLabelText('Producto *');
    await user.clear(productInput);
    await user.type(productInput, 'iphone 16');

    const option = await screen.findByRole('option', { name: /Funda iPhone 16/ });
    await user.click(option);

    expect(productInput).toHaveValue('Funda iPhone 16');

    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(update.mutateAsync).toHaveBeenCalledWith({
        id: buyFixture.id,
        input: expect.objectContaining({ product_name: 'Funda iPhone 16' }),
      });
    });
  });

  it('guarda los cambios con los valores de la compra', async () => {
    const user = userEvent.setup();
    const update = mutationMock({
      mutateAsync: vi.fn().mockResolvedValueOnce(buyFixture),
    });
    vi.mocked(useUpdateBuy).mockReturnValue(update as never);

    renderPage();

    const productInput = await screen.findByLabelText('Producto *');
    await user.clear(productInput);
    await user.type(productInput, 'Funda iPhone 16');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(update.mutateAsync).toHaveBeenCalledWith({
        id: buyFixture.id,
        input: {
          product_name: 'Funda iPhone 16',
          purchase_cost: 45.5,
          quantity: 20,
          associated_costs: 3.2,
          purchase_date: '2026-10-02',
        },
      });
    });
  });
});
