/**
 * Tests del boundary lazy del CashFlowChart.
 *
 * El chart real usa recharts, que en jsdom no tiene layout: se mockea
 * `ResponsiveContainer` con dimensiones fijas (mismo criterio que
 * `CashFlowChart.test.tsx`).
 *
 * El test no se limita a comprobar que el chart aparezca: comprueba que
 * **no** esté disponible de forma síncrona. Si alguien vuelve a importar el
 * chart de forma estática (y saca el `lazy`), el fallback desaparece y este
 * test falla. Eso es lo que fija la regla "recharts no entra en el bundle
 * inicial" sin depender del build.
 *
 * Es un único test a propósito: `React.lazy` cachea el módulo resuelto en
 * el payload del componente, así que desde el segundo render del archivo el
 * boundary ya no suspende y no hay fallback que assertar.
 */
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
    // Pre-calentamos el módulo del chart: en vitest, cargarlo (recharts +
    // transform) tarda ~1.2s y no debe competir con el timeout del assert.
    // React.lazy sigue suspendiendo en el primer render de todas formas.
    await import('../CashFlowChart');
  });

  it('muestra un fallback accesible y monta el chart real cuando resuelve el import dinámico', async () => {
    render(<LazyCashFlowChart data={DATA} />);

    // Primer render: el módulo de recharts todavía no llegó, así que el
    // chart real NO puede estar montado.
    const fallback = screen.getByTestId('cashflow-chart-fallback');
    // Fallback accesible: mismo alto que el chart (no hay salto de layout)
    // y región viva para que el lector de pantalla anuncie la carga.
    expect(fallback).toHaveClass('h-64');
    expect(fallback).toHaveAttribute('role', 'status');
    expect(screen.queryByTestId('cashflow-chart')).not.toBeInTheDocument();

    // Cuando el import dinámico resuelve, entra el chart y cae el fallback.
    expect(
      await screen.findByTestId('cashflow-chart', undefined, { timeout: 5000 }),
    ).toBeInTheDocument();
    expect(screen.queryByTestId('cashflow-chart-fallback')).not.toBeInTheDocument();
  });
});
