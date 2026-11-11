import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';

vi.mock('@/hooks/useStatsDashboard', () => ({
  useStatsDashboard: vi.fn(),
}));

import { useStatsDashboard } from '@/hooks/useStatsDashboard';
import { BuyersTab } from '@/pages/dashboard/BuyersTab';
import { renderWithProviders } from '@/test-utils/render';

const statsFixture = {
  topBuyers: [
    { customer_id: 1, customer_name: 'Ana', ventas: 2, total_gastado: 250 },
    { customer_id: 2, customer_name: 'Beto', ventas: 1, total_gastado: 90 },
  ],
};

function mockStats(data: unknown) {
  vi.mocked(useStatsDashboard).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

describe('BuyersTab', () => {
  beforeEach(() => {
    mockStats(statsFixture);
  });

  it('las filas del ranking entran con la animación de entrada', () => {
    renderWithProviders(<BuyersTab />);

    expect(screen.getByText('Ana').closest('tr')).toHaveClass('animate-row-slide-in');
    expect(screen.getByText('Beto').closest('tr')).toHaveClass('animate-row-slide-in');
  });

  it('la fila que desaparece sale con la animación de salida y se retira al terminar', async () => {
    vi.useFakeTimers();

    try {
      const { rerender } = renderWithProviders(<BuyersTab />);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      mockStats({ topBuyers: [statsFixture.topBuyers[0]] });

      rerender(<BuyersTab />);

      expect(screen.getByText('Beto').closest('tr')).toHaveClass('animate-row-slide-out');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(240);
      });

      expect(screen.queryByText('Beto')).toBeNull();
      expect(screen.getByText('Ana').closest('tr')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
