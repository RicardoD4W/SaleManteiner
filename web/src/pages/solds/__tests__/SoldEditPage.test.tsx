import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useSold', () => ({
  useSold: vi.fn(),
}));

vi.mock('@/hooks/useUpdateSold', () => ({
  useUpdateSold: vi.fn(),
}));

import { useSold } from '@/hooks/useSold';
import { useUpdateSold } from '@/hooks/useUpdateSold';
import { SoldEditPage } from '@/pages/solds/SoldEditPage';
import { renderWithProviders } from '@/test-utils/render';

const soldFixture = {
  id: 1,
  customer_id: 1,
  customer_name: 'Juan Pérez',
  sale_price: 100,
  associated_costs: 0,
  sold_at: '2026-10-05',
  notes: null,
  created_at: '2026-10-05T10:00:00.000Z',
  paid_amount: 40,
  items: [],
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
      <Route path="/solds/:id" element={<SoldEditPage />} />
    </Routes>,
    { route: '/solds/1' },
  );
}

describe('SoldEditPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSold).mockReturnValue({
      data: soldFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useUpdateSold).mockReturnValue(mutationMock() as never);
  });

  it('muestra el importe cobrado de la venta', async () => {
    renderPage();

    expect(await screen.findByLabelText('Cobrado (€)')).toHaveValue(40);
  });

  it('guarda el importe cobrado editado', async () => {
    const user = userEvent.setup();
    const update = mutationMock({
      mutateAsync: vi.fn().mockResolvedValueOnce(soldFixture),
    });
    vi.mocked(useUpdateSold).mockReturnValue(update as never);

    renderPage();

    const paidInput = await screen.findByLabelText('Cobrado (€)');
    await user.clear(paidInput);
    await user.type(paidInput, '75');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));

    await waitFor(() => {
      expect(update.mutateAsync).toHaveBeenCalledWith({
        id: soldFixture.id,
        input: expect.objectContaining({ paid_amount: 75 }),
      });
    });
  });
});
