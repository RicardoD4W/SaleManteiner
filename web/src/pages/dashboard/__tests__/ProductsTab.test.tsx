import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, screen } from '@testing-library/react';

vi.mock('@/hooks/useStatsDashboard', () => ({
  useStatsDashboard: vi.fn(),
}));

import { useStatsDashboard } from '@/hooks/useStatsDashboard';
import { ProductsTab } from '@/pages/dashboard/ProductsTab';
import { renderWithProviders } from '@/test-utils/render';

const statsFixture = {
  topProducts: [
    {
      product_id: 1,
      product_name: 'Widget',
      times_sold: 3,
      total_revenue: 300,
      total_profit: 120,
    },
    {
      product_id: 2,
      product_name: 'Gadget',
      times_sold: 1,
      total_revenue: 90,
      total_profit: 30,
    },
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

describe('ProductsTab', () => {
  beforeEach(() => {
    mockStats(statsFixture);
  });

  it('las filas del ranking entran con la animación de entrada', () => {
    renderWithProviders(<ProductsTab />);

    expect(screen.getByText('Widget').closest('tr')).toHaveClass('animate-row-slide-in');
    expect(screen.getByText('Gadget').closest('tr')).toHaveClass('animate-row-slide-in');
  });

  it('la fila que desaparece sale con la animación de salida y se retira al terminar', async () => {
    vi.useFakeTimers();

    try {
      const { rerender } = renderWithProviders(<ProductsTab />);

      act(() => {
        vi.advanceTimersByTime(200);
      });

      mockStats({ topProducts: [statsFixture.topProducts[0]] });

      rerender(<ProductsTab />);

      expect(screen.getByText('Gadget').closest('tr')).toHaveClass('animate-row-slide-out');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(240);
      });

      expect(screen.queryByText('Gadget')).toBeNull();
      expect(screen.getByText('Widget').closest('tr')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});
