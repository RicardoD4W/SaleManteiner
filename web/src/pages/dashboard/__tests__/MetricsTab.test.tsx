import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, within } from '@testing-library/react';

vi.mock('@/hooks/useStatsMetrics', () => ({
  useStatsMetrics: vi.fn(),
}));

import { useStatsMetrics } from '@/hooks/useStatsMetrics';
import { MetricsTab } from '@/pages/dashboard/MetricsTab';
import { formatEuro } from '@/lib/format';
import { METRIC_COLOR } from '@/lib/colors';
import { renderWithProviders } from '@/test-utils/render';

const metricsFixture = {
  kpis: {
    ingresos_total_eur: 300,
    beneficio_total_eur: 150,
    gastos_total_eur: 75,
    beneficio_neto_eur: 75,
    margen_pct: 50,
    gastos_sobre_ingresos_pct: 25,
    ticket_medio_eur: 150,
    beneficio_medio_venta_eur: 75,
    ventas_count: 2,
    clientes_count: 3,
    clientes_con_deuda: 1,
    deuda_total_eur: 200,
    stock_pendiente_count: 1,
    stock_coste_total_eur: 30,
  },
  mes_actual: {
    month: '2026-11',
    ingresos: 200,
    beneficio: 100,
    gastos: 75,
    resultado: 25,
    margen_pct: 50,
    ventas: 1,
  },
  mes_anterior: {
    month: '2026-10',
    ingresos: 100,
    beneficio: 50,
    gastos: 0,
    resultado: 50,
    margen_pct: 50,
    ventas: 1,
  },
  variaciones: {
    ingresos_pct: 100,
    beneficio_pct: 100,
    gastos_pct: null,
    resultado_pct: -50,
    margen_puntos: 0,
  },
  margen_productos: [
    {
      product_id: 1,
      product_name: 'Widget',
      unidades: 2,
      ingresos: 200,
      beneficio: 100,
      margen_pct: 50,
    },
  ],
  deudores: [{ customer_id: 1, customer_name: 'Ana', ventas: 1, deuda: 200 }],
  gastos_categoria: [{ category_id: 1, name: 'Alquiler', total: 75, pct: 100 }],
};

function mockMetrics(data: unknown) {
  vi.mocked(useStatsMetrics).mockReturnValue({
    data,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

function cardValue(label: string): HTMLElement {
  const labelElement = screen.getByText(label);
  const body = labelElement.parentElement as HTMLElement;
  const paragraphs = body.querySelectorAll('p');
  return paragraphs[1] as HTMLElement;
}

function euro(value: number): string {
  return formatEuro(value).replace(/\u00a0/g, ' ');
}

describe('MetricsTab', () => {
  beforeEach(() => {
    mockMetrics(metricsFixture);
  });

  it('muestra las cajitas de KPIs del mes actual', () => {
    renderWithProviders(<MetricsTab />);

    const section = within(screen.getByTestId('metrics-mes-kpis'));
    expect(section.getByText('Ingresos')).toBeInTheDocument();
    expect(section.getByText('Beneficio')).toBeInTheDocument();
    expect(section.getByText('Gastos')).toBeInTheDocument();
    expect(section.getByText('Beneficio neto')).toBeInTheDocument();
    expect(section.getByText('Margen')).toBeInTheDocument();
    expect(section.getByText('Ventas')).toBeInTheDocument();
  });

  it('muestra los KPIs globales', () => {
    renderWithProviders(<MetricsTab />);

    const section = within(screen.getByTestId('metrics-kpis'));
    expect(section.getByText('Margen global')).toBeInTheDocument();
    expect(section.getByText('Ticket medio')).toBeInTheDocument();
    expect(section.getByText('Deuda total')).toBeInTheDocument();
    expect(section.getByText('Valor del stock')).toBeInTheDocument();
    expect(cardValue('Ticket medio')).toHaveTextContent(euro(150));
    expect(cardValue('Margen global')).toHaveTextContent('50 %');
  });

  it('los KPIs de gastos, deuda y stock usan su propio color', () => {
    renderWithProviders(<MetricsTab />);

    const mes = within(screen.getByTestId('metrics-mes-kpis'));
    expect(mes.getByText('Gastos').parentElement?.querySelectorAll('p')[1]?.className).toContain(
      METRIC_COLOR.gastos,
    );

    const globales = within(screen.getByTestId('metrics-kpis'));
    expect(
      globales.getByText('Deuda total').parentElement?.querySelectorAll('p')[1]?.className,
    ).toContain(METRIC_COLOR.deuda);
    expect(
      globales.getByText('Valor del stock').parentElement?.querySelectorAll('p')[1]?.className,
    ).toContain(METRIC_COLOR.stock);
  });

  it('compara con el mes anterior y deja en blanco la variación sin base', () => {
    renderWithProviders(<MetricsTab />);

    const section = within(screen.getByTestId('metrics-variaciones'));
    expect(section.getAllByText('+100 %').length).toBe(2);
    expect(section.getByText('-50 %')).toBeInTheDocument();
    expect(section.getByText('0 pts')).toBeInTheDocument();
    expect(section.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('avisa cuando el mes anterior no tuvo actividad', () => {
    mockMetrics({ ...metricsFixture, variaciones: null });

    renderWithProviders(<MetricsTab />);

    expect(screen.getByTestId('metrics-sin-base')).toBeInTheDocument();
    expect(screen.queryByTestId('metrics-variaciones')).not.toBeInTheDocument();
  });

  it('lista los márgenes por producto, los deudores y los gastos por categoría', () => {
    renderWithProviders(<MetricsTab />);

    expect(screen.getByText('Widget')).toBeInTheDocument();
    expect(within(screen.getByTestId('metrics-deudores')).getByText('Ana')).toBeInTheDocument();
    expect(
      within(screen.getByTestId('metrics-gastos-categoria')).getByText('Alquiler'),
    ).toBeInTheDocument();
  });
});
