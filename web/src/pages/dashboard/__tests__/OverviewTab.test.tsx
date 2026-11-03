import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';

vi.mock('@/hooks/useStatsDashboard', () => ({
  useStatsDashboard: vi.fn(),
}));

vi.mock('@/components/dashboard/LazyCashFlowChart', () => ({
  LazyCashFlowChart: () => <div data-testid="cashflow-chart-stub" />,
}));

import { useStatsDashboard } from '@/hooks/useStatsDashboard';
import { OverviewTab } from '@/pages/dashboard/OverviewTab';
import { formatEuro } from '@/lib/format';
import { renderWithProviders } from '@/test-utils/render';

const statsFixture = {
  kpis: {
    compras_total_eur: 1000,
    ventas_total_eur: 2500,
    beneficio_total_eur: 500,
    gastos_total_eur: 200,
    beneficio_neto_eur: 300,
    stock_pendiente_count: 7,
  },
  cashFlowByMonth: [],
  totals12m: { ingresos: 0, beneficio: 0, mejor_mes: null },
  topProducts: [],
  topBuyers: [],
};

function cardValue(label: string): HTMLElement {
  const labelElement = screen.getByText(label);
  const body = labelElement.parentElement as HTMLElement;
  const paragraphs = body.querySelectorAll('p');
  return paragraphs[1] as HTMLElement;
}

function euro(value: number): string {
  return formatEuro(value).replace(/\u00a0/g, ' ');
}

describe('OverviewTab', () => {
  beforeEach(() => {
    vi.mocked(useStatsDashboard).mockReturnValue({
      data: statsFixture,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('muestra las seis tarjetas de KPI', () => {
    renderWithProviders(<OverviewTab />);

    expect(screen.getByText('Compras totales')).toBeInTheDocument();
    expect(screen.getByText('Ventas totales')).toBeInTheDocument();
    expect(screen.getByText('Beneficio')).toBeInTheDocument();
    expect(screen.getByText('Gastos')).toBeInTheDocument();
    expect(screen.getByText('Beneficio neto')).toBeInTheDocument();
    expect(screen.getByText('Stock pendiente')).toBeInTheDocument();
  });

  it('el KPI de beneficio conserva su valor y su color por signo', () => {
    renderWithProviders(<OverviewTab />);

    expect(cardValue('Beneficio')).toHaveTextContent(`+${euro(500)}`);
    expect(cardValue('Beneficio').className).toMatch(/text-emerald-800/);
  });

  it('el KPI de gastos muestra el total de gastos en euros', () => {
    renderWithProviders(<OverviewTab />);

    expect(cardValue('Gastos')).toHaveTextContent(euro(200));
  });

  it('el KPI de beneficio neto descuenta los gastos y es verde si es >= 0', () => {
    renderWithProviders(<OverviewTab />);

    expect(cardValue('Beneficio neto')).toHaveTextContent(`+${euro(300)}`);
    expect(cardValue('Beneficio neto').className).toMatch(/text-emerald-800/);
  });

  it('el KPI de beneficio neto es rojo si es negativo', () => {
    vi.mocked(useStatsDashboard).mockReturnValue({
      data: {
        ...statsFixture,
        kpis: { ...statsFixture.kpis, beneficio_neto_eur: -120 },
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<OverviewTab />);

    expect(cardValue('Beneficio neto')).toHaveTextContent(euro(-120));
    expect(cardValue('Beneficio neto').className).toMatch(/text-red-700/);
  });

  it('la rejilla de KPIs se adapta: 2 columnas en móvil, 3 en sm y 6 en xl', () => {
    renderWithProviders(<OverviewTab />);

    const grid = screen.getByTestId('overview-kpis');
    expect(grid.className).toMatch(/grid-cols-2/);
    expect(grid.className).toMatch(/sm:grid-cols-3/);
    expect(grid.className).toMatch(/xl:grid-cols-6/);
  });
});
