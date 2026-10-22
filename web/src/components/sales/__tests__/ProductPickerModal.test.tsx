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

  it('no renderiza nada si isOpen=false', () => {
    vi.mocked(useBuysStock).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);
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
    renderWithProviders(<ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);
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
    renderWithProviders(<ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);
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

    renderWithProviders(<ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

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

    renderWithProviders(<ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

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
      // Tope de la cantidad: el stock disponible.
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

    renderWithProviders(<ProductPickerModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} />);

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

    renderWithProviders(<ProductPickerModal isOpen={true} onClose={onClose} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /Cerrar/ }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // S1 (feature-modal-venta-ux): al reabrir el picker desde "+ Cambiar
  // productos", lo ya elegido tiene que venir preseleccionado.
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
        isOpen={true}
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
    // La cantidad viene preseleccionada, no la de por defecto (1).
    expect(screen.getByLabelText('Cantidad para Funda iPhone')).toHaveValue(3);
  });

  // S3 (feature-modal-venta-ux): escribir la cantidad tiene que REEMPLAZAR
  // el valor anterior, no concatenarse ("1" + "2" = "12").
  it('al enfocar el input de cantidad se selecciona su contenido', async () => {
    const user = userEvent.setup();
    vi.mocked(useBuysStock).mockReturnValue({
      data: mockBuysWithStock as never,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as never);

    renderWithProviders(<ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('checkbox')[0]);

    const input = screen.getByLabelText('Cantidad para Funda iPhone');
    expect(input).toHaveValue(1);

    // El contenido se selecciona al enfocar: al escribir, el valor nuevo
    // reemplaza al anterior en vez de concatenarse ("1" + "2" = "12").
    // OJO: en un input type="number" el rango de selección no es observable
    // (devuelve null), así que se comprueba la llamada a select().
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

    renderWithProviders(<ProductPickerModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });

    await user.click(screen.getAllByRole('checkbox')[0]);

    const input = screen.getByLabelText('Cantidad para Funda iPhone');
    // 8 disponibles: escribir 99 se recorta a 8.
    fireEvent.change(input, { target: { value: '99' } });
    expect(input).toHaveValue(8);
  });

  // Al reabrir el picker con "+ Cambiar productos", lo que ya estaba
  // marcado se muestra ARRIBA del todo (para no ir a buscarlo).
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
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialSelection={[{ buy_id: 2, quantity: 1 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Cargador USB-C')).toBeInTheDocument();
    });

    // El primero de la lista es el que ya estaba tildado.
    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cargador USB-C');
    expect(items[1]).toHaveTextContent('Funda iPhone');
  });

  // El orden se congela al abrir: tildar o destildar NO reordena la lista,
  // así la fila que tenés bajo el puntero no se te escapa.
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
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={vi.fn()}
        initialSelection={[{ buy_id: 2, quantity: 1 }]}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText('Cargador USB-C')).toBeInTheDocument();
    });

    // Tilda "Funda iPhone" (el que estaba abajo).
    await user.click(screen.getAllByRole('checkbox')[0]);

    const items = screen.getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Cargador USB-C');
    expect(items[1]).toHaveTextContent('Funda iPhone');
  });
});
