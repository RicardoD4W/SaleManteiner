import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useBuy', () => ({
  useBuy: vi.fn(),
}));

vi.mock('@/hooks/useUpdateBuy', () => ({
  useUpdateBuy: vi.fn(),
}));

import { useBuy } from '@/hooks/useBuy';
import { useUpdateBuy } from '@/hooks/useUpdateBuy';
import { BuyEditPage } from '@/pages/buys/BuyEditPage';
import { renderWithProviders } from '@/test-utils/render';

const buyFixture = {
  id: 1,
  product_name: 'Funda iPhone 15',
  purchase_cost: 45.5,
  quantity: 20,
  associated_costs: 3.2,
  purchase_date: '2026-10-02',
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
