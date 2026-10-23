import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const Real = actual.ResponsiveContainer;
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <Real width={800} height={240}>
        {children}
      </Real>
    ),
  };
});

import { LazyCashFlowChart } from '../LazyCashFlowChart';

const DATA = [
  { month: '2026-01', compras: 100, ventas: 50, beneficio_real: -20 },
  { month: '2026-02', compras: 200, ventas: 150, beneficio_real: -50 },
];

describe('LazyCashFlowChart', () => {
  beforeAll(async () => {
    await import('../CashFlowChart');
  });

  it('muestra un fallback accesible y monta el chart real cuando resuelve el import dinámico', async () => {
    render(<LazyCashFlowChart data={DATA} />);

    const fallback = screen.getByTestId('cashflow-chart-fallback');
    expect(fallback).toHaveClass('h-64');
    expect(fallback).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('cashflow-chart')).not.toBeInTheDocument();

    expect(
      await screen.findByTestId('cashflow-chart', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cashflow-chart-fallback')).not.toBeInTheDocument();
  });
});
