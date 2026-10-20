/**
 * Tests del componente SaleNewModal (step 2 del flujo multi-step).
 *
 * Cubre el flujo de "+ Cambiar productos":
 *  - S2: al volver a elegir el mismo producto con más unidades, la modal
 *    refleja la cantidad final.
 *  - S4: cancelar el picker vuelve a la modal de venta (conservando la
 *    info) en vez de cancelar toda la venta.
 *
 * Spec: `odd/tasks/feature-modal-venta-ux.md`.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/hooks/useCreateSold', () => ({
  useCreateSold: vi.fn(),
}));
vi.mock('@/hooks/useBuysStock', () => ({
  useBuysStock: vi.fn(),
}));
vi.mock('@/hooks/useCustomers', () => ({
  useCustomers: vi.fn(),
}));
vi.mock('@/hooks/useCreateCustomer', () => ({
  useCreateCustomer: vi.fn(),
}));

import { useCreateSold } from '@/hooks/useCreateSold';
import { useBuysStock } from '@/hooks/useBuysStock';
import { useCustomers } from '@/hooks/useCustomers';
import { useCreateCustomer } from '@/hooks/useCreateCustomer';
import { SaleNewModal } from '@/components/sales/SaleNewModal';
import { renderWithProviders } from '@/test-utils/render';

const mockBuysWithStock = [
  { id: 1, product_name: 'Funda iPhone', quantity: 10, disponibles: 8 },
  { id: 2, product_name: 'Cargador USB-C', quantity: 5, disponibles: 3 },
];

function mockHooks() {
  vi.mocked(useBuysStock).mockReturnValue({
    data: mockBuysWithStock as never,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useCustomers).mockReturnValue({
    data: [] as never,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useCreateCustomer).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
    variables: undefined,
  } as never);
  vi.mocked(useCreateSold).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    isError: false,
    error: null,
    data: null,
    reset: vi.fn(),
    mutate: vi.fn(),
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    failureCount: 0,
    failureReason: null,
    submittedAt: 0,
    context: undefined,
    variables: undefined,
  } as never);
}

describe('SaleNewModal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHooks();
  });

  // S2: el flujo completo. Antes, al reabrir el picker no venía nada
  // preseleccionado, así que al volver a tildar el producto la cantidad
  // volvía a 1 y la modal de venta mostraba "1 unidad" en vez de lo elegido.
  it('refleja la cantidad final cuando se vuelve a elegir el mismo producto', async () => {
    const user = userEvent.setup();
    renderWithProviders(<SaleNewModal onClose={vi.fn()} />);

    // Step 1: elegir "Funda iPhone" con 1 unidad.
    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    // Step 2: la modal de venta ya está.
    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByText('Productos (1)')).toBeInTheDocument();

    // Step 3: "+ Cambiar productos" reabre el picker CON lo elegido.
    await user.click(screen.getByRole('button', { name: /\+ Cambiar productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Seleccionar productos')).toBeInTheDocument();
    });
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes[0]).toBeChecked();

    // Step 4: subir la cantidad a 2 y confirmar.
    // OJO: se cambia el valor con fireEvent y no escribiendo. En jsdom el
    // input type="number" no hace la selección de texto al enfocar (eso sí
    // funciona en el navegador real, y lo cubre el e2e), así que aquí
    // "2" se concatenaría a "12" y el clamp lo dejaría en 8.
    const input = screen.getByLabelText('Cantidad para Funda iPhone');
    fireEvent.change(input, { target: { value: '2' } });
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));

    // Step 5: la modal de venta refleja 2 unidades.
    await waitFor(() => {
      expect(screen.getByText('Productos (1)')).toBeInTheDocument();
    });
    expect(screen.getByLabelText('Cantidad para Funda iPhone')).toHaveValue(2);
  });

  // S4: cancelar el picker es "volver atrás", no descartar la venta.
  it('cancelar el picker vuelve a la modal de venta sin cerrar la venta', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    renderWithProviders(<SaleNewModal onClose={onClose} />);

    // Elegir un producto para tener algo que conservar.
    await waitFor(() => {
      expect(screen.getByText('Funda iPhone')).toBeInTheDocument();
    });
    await user.click(screen.getAllByRole('checkbox')[0]);
    await user.click(screen.getByRole('button', { name: /Confirmar/ }));
    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });

    // Reabrir el picker y cancelar.
    await user.click(screen.getByRole('button', { name: /\+ Cambiar productos/ }));
    await waitFor(() => {
      expect(screen.getByText('Seleccionar productos')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: /Cancelar/ }));

    // Vuelve a la modal de venta, con lo elegido, y NO se cierra la venta.
    await waitFor(() => {
      expect(screen.getByText('Nueva venta')).toBeInTheDocument();
    });
    expect(screen.getByText('Productos (1)')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
