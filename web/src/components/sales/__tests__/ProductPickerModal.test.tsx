/**
 * Tests del componente ProductPickerModal.
 *
 * Verifica:
 *  - Renderiza estado de carga / vacío / con datos.
 *  - El modal abre/cierra correctamente.
 *  - Multi-select con checkboxes.
 *  - Confirm llama a `onConfirm` con los items correctos.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useBuysStock', () => ({
  useBuysStock: vi.fn(),
}));

import { useBuysStock } from '@/hooks/useBuysStock';
import { ProductPickerModal } from '@/components/sales/ProductPickerModal';
import { renderWithProviders } from '@/test-utils/render';

const mockBuysWithStock = [
  { id: 1, product_name: 'Funda iPhone', quantity: 10, disponibles: 8 },
  { id: 2, product_name: 'Cargador USB-C', quantity: 5, disponibles: 3 },
];

describe('ProductPickerModal', () => {
  beforeEach(() => {
    vi.mocked(useBuysStock).mockReset();
  });

  it('no renderiza nada si isOpen=false', () => {
    vi.mocked(useBuysStock).mockReturnValue({ data: [], isLoading: false, isError: false, error: null, refetch: vi.fn() } as never);
    renderWithProviders(
      <ProductPickerModal isOpen={false} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('renderiza estado de carga cuando isLoading=true', () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/Cargando productos/)).toBeInTheDocument();
  });

  it('renderiza estado vacío cuando no hay buys con stock', () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );
    expect(screen.getByText(/No hay productos con stock disponible/)).toBeInTheDocument();
  });

  it('renderiza la lista de buys con stock y muestra disponibles', async () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
      expect(screen.getByText('Cargador USB-C')).toBeInTheDocument();
    });
    expect(screen.getByText(/8 disponibles/)).toBeInTheDocument();
    expect(screen.getByText(/3 disponibles/)).toBeInTheDocument();
  });

  it('checkbox permite multi-select', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    // Confirmar que ambos están tildados.
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();

    // Contador dice "2 seleccionados".
    expect(screen.getByText(/2 seleccionados/)).toBeInTheDocument();
  });

  it('confirmar llama a onConfirm con items correctos y cantidad 1', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={onConfirm} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    const calledItems = onConfirm.mock.calls[0]?.[0] as Array<{ buy_id: number; quantity: number }>;
    expect(calledItems).toContainEqual({ buy_id: 1, quantity: 1 });
  });

  it('el botón Cancelar llama a onClose', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('el botón Cerrar (X) llama a onClose', async () => {
    const onClose = vi.fn();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
