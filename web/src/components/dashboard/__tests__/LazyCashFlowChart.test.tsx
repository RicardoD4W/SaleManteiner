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
  { month: '2026-01', ingresos: 80, compras: 100, beneficio: 50, resultado: -20 },
  { month: '2026-02', ingresos: 180, compras: 200, beneficio: 150, resultado: -50 },
];

describe('LazyCashFlowChart', () => {
  beforeAll(async () => {
    await import('../CashFlowChart');
  });

  it('muestra un fallback accesible mientras el chart carga', async () => {
    vi.resetModules();
    vi.doMock('../CashFlowChart', () => new Promise(() => {}));

    const { LazyCashFlowChart: PendingChart } = await import('../LazyCashFlowChart');
    render(<PendingChart data={DATA} />);

    const fallback = await screen.findByTestId('cashflow-chart-fallback');
    expect(fallback).toHaveClass('h-64');
    expect(fallback).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('cashflow-chart')).not.toBeInTheDocument();

    vi.doUnmock('../CashFlowChart');
    vi.resetModules();
  });

  it('monta el chart real cuando resuelve el import dinámico', async () => {
    render(<LazyCashFlowChart data={DATA} />);

    expect(
      await screen.findByTestId('cashflow-chart', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cashflow-chart-fallback')).not.toBeInTheDocument();
  });
});
