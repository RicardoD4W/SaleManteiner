import { describe, expect, it, vi, beforeEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useSold', () => ({
  useSold: vi.fn(),
}));

vi.mock('@/hooks/useCustomer', () => ({
  useCustomer: vi.fn(),
}));

import { useSold } from '@/hooks/useSold';
import { useCustomer } from '@/hooks/useCustomer';
import { SoldReceiptPage } from '@/pages/solds/SoldReceiptPage';
import { renderWithProviders } from '@/test-utils/render';

const soldFixture = {
  id: 1,
  customer_id: 3,
  customer_name: 'Ana García',
  sale_price: 120,
  associated_costs: 12.5,
  sold_at: '2026-10-05',
  notes: 'Nota interna del vendedor',
  created_at: '2026-10-05T10:00:00.000Z',
  paid_amount: 50,
  items: [
    { buy_id: 10, product_name: 'iPhone 15', quantity: 2, unit_cost: 400, unit_assoc: 0 },
    { buy_id: 11, product_name: 'Funda', quantity: 1, unit_cost: 3, unit_assoc: 0 },
  ],
};

const customerFixture = {
  id: 3,
  name: 'Ana García',
  phone: '612345678',
  address: 'Calle Mayor 1',
  notes: null,
  created_at: '2026-10-02T10:00:00.000Z',
};

function renderPage() {
  return renderWithProviders(
    <Routes>
      <Route path="/solds/:id/receipt" element={<SoldReceiptPage />} />
    </Routes>,
    { route: '/solds/1/receipt' },
  );
}

describe('SoldReceiptPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useSold).mockReturnValue({
      data: soldFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    vi.mocked(useCustomer).mockReturnValue({
      data: customerFixture as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
  });

  it('muestra los datos del cliente', async () => {
    renderPage();

    expect(await screen.findByText('Ana García')).toBeInTheDocument();
    expect(screen.getByText('612 345 678')).toBeInTheDocument();
    expect(screen.getByText('Calle Mayor 1')).toBeInTheDocument();
  });

  it('muestra los productos vendidos y el total', async () => {
    renderPage();

    expect(await screen.findByText('iPhone 15')).toBeInTheDocument();
    expect(screen.getByText('Funda')).toBeInTheDocument();
    expect(screen.getByText('120,00 €')).toBeInTheDocument();
  });

  it('muestra el cobrado y el pendiente cuando hay importe cobrado', async () => {
    renderPage();

    expect(await screen.findByText('50,00 €')).toBeInTheDocument();
    expect(screen.getByText('70,00 €')).toBeInTheDocument();
  });

  it('no muestra ni las notas internas ni los gastos asociados', async () => {
    renderPage();

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Recibo de venta' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nota interna del vendedor')).not.toBeInTheDocument();
    expect(screen.queryByText('12,50 €')).not.toBeInTheDocument();
  });

  it('nombra los datos que viajan entre la tabla y el recibo', async () => {
    renderPage();

    expect(await screen.findByText('Ana García')).toHaveAttribute('data-vt-name', 'sold-client-1');
    expect(screen.getByText('05/10/2026')).toHaveAttribute('data-vt-name', 'sold-date-1');
    expect(screen.getByText('120,00 €')).toHaveAttribute('data-vt-name', 'sold-price-1');
    expect(screen.getByText('iPhone 15')).toHaveAttribute('data-vt-name', 'sold-item-10-name-1');
  });

  it('el botón de imprimir llama a window.print', async () => {
    const user = userEvent.setup();
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Imprimir o guardar como PDF' }));

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('avisa y vuelve a la lista si el id no es válido', async () => {
    renderWithProviders(
      <Routes>
        <Route path="/solds/:id/receipt" element={<SoldReceiptPage />} />
      </Routes>,
      { route: '/solds/abc/receipt' },
    );

    expect(await screen.findByText('Id de venta inválido.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Volver' })).toHaveAttribute('href', '/solds');
  });

  it('avisa si la venta no existe', async () => {
    vi.mocked(useSold).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error('Venta no encontrada'),
      refetch: vi.fn(),
    } as never);

    renderPage();

    expect(await screen.findByText(/No se pudo cargar la venta/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '← Volver' })).toHaveAttribute('href', '/solds');
  });
});
