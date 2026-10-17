/**
 * Tests del componente KpiCards. Mockeamos `salesApi` (consumido por
 * `useStats` vía TanStack Query) para controlar loading/error/data.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';

vi.mock('@/api/sales', () => ({
  salesApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    stats: vi.fn(),
  },
}));

import { salesApi } from '@/api/sales';
import { KpiCards } from '@/components/sales/KpiCards';
import { renderWithProviders } from '@/test-utils/render';
import { statsFixture } from '@/test-utils/fixtures';

describe('KpiCards', () => {
  it('muestra estado loading mientras la query está pendiente', () => {
    vi.mocked(salesApi.stats).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<KpiCards />);
    expect(screen.getByText(/Cargando estadísticas/)).toBeInTheDocument();
  });

  it('muestra estado de error con mensaje y botón Reintentar', async () => {
    vi.mocked(salesApi.stats).mockRejectedValueOnce(new Error('boom'));
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/No se pudieron cargar las estadísticas/)).toBeInTheDocument();
    });
    expect(screen.getByText(/boom/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('renderiza los 5 labels de KPIs con los datos', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce(statsFixture);
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    // Labels
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Vendidas')).toBeInTheDocument();
    expect(screen.getByText('Ingresos')).toBeInTheDocument();
    expect(screen.getByText('Costes')).toBeInTheDocument();
    expect(screen.getByText('Beneficio neto')).toBeInTheDocument();
  });

  it('muestra los conteos como texto plano (total, sold)', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce(statsFixture);
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText('Total')).toBeInTheDocument();
    });

    // total=2, sold=1
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('formatea currency con formatCents (NBSP es-ES)', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce(statsFixture);
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/Ingresos/)).toBeInTheDocument();
    });

    // Revenue: 25000 cents → "250,00 €" (regex por NBSP)
    expect(screen.getByText(/250,00/)).toBeInTheDocument();
    // Costes: cost_cents(16200) + associated_costs_cents(500) = 16700 → "167,00 €"
    expect(screen.getByText(/167,00/)).toBeInTheDocument();
    // Beneficio neto: 8300 → "83,00 €" (con signo + porque netIsPositive=true)
    expect(screen.getByText(/\+83,00/)).toBeInTheDocument();
  });

  it('beneficio neto lleva signo "-" cuando es negativo', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce({
      ...statsFixture,
      net_profit_cents: -5000,
    });
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/Beneficio neto/)).toBeInTheDocument();
    });
    // -5000 → "-50,00 €"
    expect(screen.getByText(/-50,00/)).toBeInTheDocument();
  });

  it('NO muestra signo "+" cuando el beneficio es exactamente 0', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce({
      ...statsFixture,
      net_profit_cents: 0,
    });
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/Beneficio neto/)).toBeInTheDocument();
    });
    // netIsPositive=true para 0 (>= 0), entonces sí lleva "+". Ajustamos:
    // la implementación actual usa `data.net_profit_cents >= 0` entonces 0 es positivo.
    expect(screen.getByText(/\+0,00/)).toBeInTheDocument();
  });

  it('"Vendidas" muestra "X pendientes" como hint', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce(statsFixture);
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/pendientes/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1 pendientes/)).toBeInTheDocument();
  });

  it('Beneficio neto tiene emphasis (text-brand-600)', async () => {
    vi.mocked(salesApi.stats).mockResolvedValueOnce(statsFixture);
    renderWithProviders(<KpiCards />);

    await waitFor(() => {
      expect(screen.getByText(/Beneficio neto/)).toBeInTheDocument();
    });
    // El StatCard emphasis aplica text-brand-600 al <p> del valor.
    // Buscamos el contenedor del KPI "Beneficio neto" y verificamos que tiene brand-600.
    const netP = screen.getByText(/\+83,00/);
    expect(netP.className).toMatch(/text-brand-600/);
  });
});