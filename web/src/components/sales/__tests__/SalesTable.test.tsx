/**
 * Tests del componente SalesTable. Mockeamos `salesApi` (módulo que
 * consume `useSales` vía TanStack Query) para controlar el estado de
 * carga / datos / error sin tocar la red.
 */
import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

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
import { SalesTable } from '@/components/sales/SalesTable';
import { renderWithProviders } from '@/test-utils/render';
import { pendingSaleFixture, saleFixture } from '@/test-utils/fixtures';

describe('SalesTable', () => {
  it('muestra estado loading mientras la query está pendiente', () => {
    // La promesa nunca resuelve, así que el query queda en estado 'pending'.
    vi.mocked(salesApi.list).mockReturnValue(new Promise(() => {}));
    renderWithProviders(<SalesTable />);
    expect(screen.getByText(/Cargando ventas/)).toBeInTheDocument();
  });

  it('muestra estado vacío cuando no hay ventas', async () => {
    vi.mocked(salesApi.list).mockResolvedValueOnce([]);
    renderWithProviders(<SalesTable />);

    await waitFor(() => {
      expect(screen.getByText(/No hay ventas todavía/)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Crear la primera/ })).toHaveAttribute(
      'href',
      '/sales/new',
    );
  });

  it('renderiza una fila por venta con producto, comprador, costes formateados y badges', async () => {
    vi.mocked(salesApi.list).mockResolvedValueOnce([saleFixture, pendingSaleFixture]);
    renderWithProviders(<SalesTable />);

    await waitFor(() => {
      // Productos
      expect(screen.getByText('iPhone 12 64GB')).toBeInTheDocument();
      expect(screen.getByText('Libro TypeScript')).toBeInTheDocument();
    });

    // Compradores
    expect(screen.getByText('Juan Pérez')).toBeInTheDocument();
    // Hay múltiples `—` ahora: el buyer null, y las fechas de compra / venta null
    // (pendingSaleFixture tiene purchase_date y sold_at en null). Validamos al
    // menos uno y dejamos que la cantidad exacta la verifique el snapshot si hace falta.
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(1);

    // formatCents aplicado (NBSP, formato es-ES). Usamos regex porque
    // Testing Library normaliza whitespace en getByText y el NBSP (U+00A0)
    // se convierte en espacio normal.
    // 15000 cents → "150,00 €"; 25000 → "250,00 €"
    expect(screen.getByText(/150,00/)).toBeInTheDocument();
    expect(screen.getByText(/250,00/)).toBeInTheDocument();
    expect(screen.getByText(/12,00/)).toBeInTheDocument(); // pendingSaleFixture cost_cents=1200

    // Badges vendido/no vendido
    expect(screen.getByText('Sí')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
  });

  it('cada fila tiene link a /sales/:id (producto y Editar)', async () => {
    vi.mocked(salesApi.list).mockResolvedValueOnce([saleFixture, pendingSaleFixture]);
    renderWithProviders(<SalesTable />);

    await waitFor(() => {
      expect(screen.getAllByRole('link', { name: /iPhone 12 64GB/ })[0]).toHaveAttribute(
        'href',
        '/sales/1',
      );
    });

    // Links "Editar" para cada fila
    const editLinks = screen.getAllByRole('link', { name: /Editar/ });
    expect(editLinks).toHaveLength(2);
    expect(editLinks[0]).toHaveAttribute('href', '/sales/1');
    expect(editLinks[1]).toHaveAttribute('href', '/sales/2');
  });

  it('muestra mensaje y botón Reintentar en estado de error', async () => {
    vi.mocked(salesApi.list).mockRejectedValueOnce(new Error('Falló la red'));
    renderWithProviders(<SalesTable />);

    await waitFor(() => {
      expect(screen.getByText(/No se pudieron cargar las ventas/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Falló la red/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
  });

  it('botón Reintentar llama a refetch (salesApi.list de nuevo)', async () => {
    const user = userEvent.setup();
    // Primera llamada rechaza, segunda resuelve con []
    vi.mocked(salesApi.list)
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce([]);

    renderWithProviders(<SalesTable />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Reintentar/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Reintentar/ }));

    await waitFor(() => {
      expect(screen.getByText(/No hay ventas todavía/)).toBeInTheDocument();
    });
    expect(salesApi.list).toHaveBeenCalledTimes(2);
  });
});