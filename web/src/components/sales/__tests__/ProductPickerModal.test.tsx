import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
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

  it('renderiza estado de carga cuando isLoading=true', () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={vi.fn()} />);
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
    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={vi.fn()} />);
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

    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={vi.fn()} />);

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

    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(checkboxes[1]);

    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).toBeChecked();

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

    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={onConfirm} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    await waitFor(() => {
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    const calledItems = onConfirm.mock.calls[0]?.[0] as Array<{
      buy_id: number;
      product_name: string;
      quantity: number;
      max: number;
    }>;
    expect(calledItems).toContainEqual({
      buy_id: 1,
      product_name: 'Funda iPhone',
      quantity: 1,
      max: 8,
    });
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

    renderWithProviders(<ProductPickerModal onClose={onClose} onConfirm={vi.fn()} />);

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

    renderWithProviders(<ProductPickerModal onClose={onClose} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('preselecciona los items que le llegan en initialSelection', async () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialSelection={[{ buy_id: 1, quantity: 3 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();
    expect(checkboxes[1]).not.toBeChecked();
    expect(screen.getByText(/1 seleccionado/)).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad para Funda iPhone')).toHaveValue(3);
  });

  it('al enfocar el input de cantidad se selecciona su contenido', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('checkbox')[0]);

    const input = screen.getByLabelText('Cantidad para Funda iPhone');
    expect(input).toHaveValue(1);

    const selectSpy = vi.spyOn(input as HTMLInputElement, 'select');
    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalled();
  });

  it('la cantidad no puede pasar de las unidades disponibles', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<ProductPickerModal onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('checkbox')[0]);

    const input = screen.getByLabelText('Cantidad para Funda iPhone');
    fireEvent.change(input, { target: { value: '99' } });
    expect(input).toHaveValue(8);
  });

  it('muestra arriba del todo los productos que ya venían seleccionados', async () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialSelection={[{ buy_id: 2, quantity: 1 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Cargador USB-C')).toBeInTheDocument();
    });

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cargador USB-C');
    expect(items[1]).toHaveTextContent('Funda iPhone');
  });

  it('no reordena la lista al tildar dentro del modal', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(
      <ProductPickerModal
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialSelection={[{ buy_id: 2, quantity: 1 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Cargador USB-C')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('checkbox')[0]);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cargador USB-C');
    expect(items[1]).toHaveTextContent('Funda iPhone');
  });
});
