import { describe, expect, it, vi } from 'vitest';
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

import { CashFlowChart } from '../CashFlowChart';

const DATA = [
  { month: '2026-01', compras: 100, ventas: 50, beneficio_real: -20 },
  { month: '2026-02', compras: 200, ventas: 150, beneficio_real: -50 },
  { month: '2026-03', compras: 150, ventas: 180, beneficio_real: 30 },
];

describe('CashFlowChart (recharts)', () => {
  it('renderiza el chart con sus tres series y la leyenda', () => {
    const { container } = render(<CashFlowChart data={DATA} />);

    const root = container.querySelector('[data-testid="cashflow-chart"]');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('role', 'img');
    expect(root).toHaveAttribute(
      'aria-label',
      'Flujo de caja por mes (compras, beneficio y resultado del mes)',
    );

    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(3);
    expect(screen.getByText('Compras')).toBeInTheDocument();
    expect(screen.getByText('Beneficio')).toBeInTheDocument();
    expect(screen.getByText('Resultado del mes')).toBeInTheDocument();
  });

  it('la serie de beneficio real se dibuja con el naranja de marca', () => {
    const { container } = render(<CashFlowChart data={DATA} />);

    const strokes = Array.from(container.querySelectorAll('.recharts-line-curve')).map((el) =>
      el.getAttribute('stroke'),
    );
    expect(strokes).toContain('var(--color-chart-beneficio)');
  });

  it('el eje Y cubre el beneficio real cuando es más negativo que las ventas', () => {
    const { container } = render(
      <CashFlowChart
        data={[
          { month: '2026-01', compras: 0, ventas: 0, beneficio_real: -500 },
          { month: '2026-02', compras: 0, ventas: 0, beneficio_real: -500 },
        ]}
      />,
    );

    const tickValues = Array.from(
      container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value'),
    ).map((el) => el.textContent ?? '');

    expect(tickValues.some((t) => t.trim().startsWith('-'))).toBe(true);
  });

  it('muestra los meses en español en el eje X', () => {
    render(<CashFlowChart data={DATA} />);

    expect(screen.getByText('ene')).toBeInTheDocument();
    expect(screen.getByText('feb')).toBeInTheDocument();
    expect(screen.getByText('mar')).toBeInTheDocument();
  });

  it('sin datos: muestra "Sin datos." y no dibuja el chart', () => {
    const { container } = render(<CashFlowChart data={[]} />);

    expect(screen.getByText('Sin datos.')).toBeInTheDocument();
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(0);
  });

  it('con ventas negativas: el eje Y incluye valores negativos', () => {
    const { container } = render(
      <CashFlowChart
        data={[
          { month: '2026-01', compras: 100, ventas: -10, beneficio_real: -50 },
          { month: '2026-02', compras: 200, ventas: 150, beneficio_real: -50 },
        ]}
      />,
    );

    const tickValues = Array.from(
      container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value'),
    ).map((el) => el.textContent ?? '');

    expect(tickValues.some((t) => t.trim().startsWith('-'))).toBe(true);
    expect(tickValues.length).toBeGreaterThan(1);
  });
});
