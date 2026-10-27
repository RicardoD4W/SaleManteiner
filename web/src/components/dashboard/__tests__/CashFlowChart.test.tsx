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
  { month: '2026-01', ingresos: 80, compras: 100, beneficio: 50, resultado: -20 },
  { month: '2026-02', ingresos: 180, compras: 200, beneficio: 150, resultado: -50 },
  { month: '2026-03', ingresos: 220, compras: 150, beneficio: 180, resultado: 30 },
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

  it('reserva en la leyenda el alto de dos líneas: en móvil no puede pisar el eje Y', () => {
    const { container } = render(<CashFlowChart data={DATA} />);

    const legend = container.querySelector<HTMLElement>('.recharts-legend-wrapper');
    expect(legend).not.toBeNull();

    const height = Number.parseFloat(legend?.style.height ?? '0');
    const fontSize = Number.parseFloat(legend?.style.fontSize ?? '0');
    const lineHeight = Number.parseFloat(legend?.style.lineHeight ?? '0');

    expect(fontSize).toBeGreaterThan(0);
    expect(lineHeight).toBeGreaterThan(0);
    expect(height).toBeGreaterThanOrEqual(2 * lineHeight);
  });

  it('la serie de resultado del mes se dibuja con el naranja de marca', () => {
    const { container } = render(<CashFlowChart data={DATA} />);

    const strokes = Array.from(container.querySelectorAll('.recharts-line-curve')).map((el) =>
      el.getAttribute('stroke'),
    );
    expect(strokes).toContain('var(--color-chart-profit)');
  });

  it('el eje Y cubre el resultado cuando es más negativo que el beneficio', () => {
    const { container } = render(
      <CashFlowChart
        data={[
          { month: '2026-01', ingresos: 0, compras: 0, beneficio: 0, resultado: -500 },
          { month: '2026-02', ingresos: 0, compras: 0, beneficio: 0, resultado: -500 },
        ]}
      />,
    );

    const tickValues = Array.from(
      container.querySelectorAll('.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value'),
    ).map((el) => el.textContent ?? '');

    expect(tickValues.some((t) => t.trim().startsWith('-500'))).toBe(true);
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

  it('con beneficio negativo: el eje Y incluye valores negativos', () => {
    const { container } = render(
      <CashFlowChart
        data={[
          { month: '2026-01', ingresos: 0, compras: 100, beneficio: -10, resultado: -50 },
          { month: '2026-02', ingresos: 180, compras: 200, beneficio: 150, resultado: -50 },
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
