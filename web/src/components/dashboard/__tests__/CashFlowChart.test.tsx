/**
 * Tests del CashFlowChart con recharts (S1 del feature `recharts-charts`).
 *
 * El chart se dibuja con recharts, así que el DOM es el de recharts: las
 * curvas son `.recharts-line-curve`, los ticks del eje Y son
 * `.recharts-cartesian-axis-tick-value` dentro de `.recharts-yAxis`.
 *
 * jsdom no tiene layout, así que `ResponsiveContainer` (que mide el
 * contenedor) se mockea con dimensiones fijas: el resto de recharts
 * renderiza de verdad y los assertsOperan sobre el SVG real.
 */
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';

vi.mock('recharts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('recharts')>();
  const Real = actual.ResponsiveContainer;
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children?: ReactNode }) => (
      <Real width={800} height={240}>{children}</Real>
    ),
  };
});

import { CashFlowChart } from '../CashFlowChart';

const DATA = [
  { month: '2026-01', compras: 100, ventas: 50, neto: -50 },
  { month: '2026-02', compras: 200, ventas: 150, neto: -50 },
  { month: '2026-03', compras: 150, ventas: 180, neto: 30 },
];

describe('CashFlowChart (recharts)', () => {
  it('renderiza el chart con sus dos series y la leyenda', () => {
    const { container } = render(<CashFlowChart data={DATA} />);

    // El contenedor conserva el contrato que usan los e2e.
    const root = container.querySelector('[data-testid="cashflow-chart"]');
    expect(root).toBeInTheDocument();
    expect(root).toHaveAttribute('role', 'img');
    expect(root).toHaveAttribute(
      'aria-label',
      'Flujo de caja por mes (compras vs ventas)',
    );

    // Dos curvas: Compras (gastos) y Ventas (ingresos).
    expect(container.querySelectorAll('.recharts-line-curve')).toHaveLength(2);
    expect(screen.getByText('Compras (gastos)')).toBeInTheDocument();
    expect(screen.getByText('Ventas (ingresos)')).toBeInTheDocument();
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
          { month: '2026-01', compras: 100, ventas: -10, neto: -110 },
          { month: '2026-02', compras: 200, ventas: 150, neto: -50 },
        ]}
      />,
    );

    const tickValues = Array.from(
      container.querySelectorAll(
        '.recharts-yAxis-tick-labels .recharts-cartesian-axis-tick-value',
      ),
    ).map((el) => el.textContent ?? '');

    // El cero siempre está (referencia) y hay al menos un tick negativo:
    // es el fix del dominio Y (antes la venta negativa se salía del área).
    expect(tickValues.some((t) => t.trim().startsWith('-'))).toBe(true);
    expect(tickValues.length).toBeGreaterThan(1);
  });
});
