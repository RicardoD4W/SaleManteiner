/**
 * Tests del componente SaleForm. Mockeamos los hooks de mutación
 * (`useCreateSale` y `useUpdateSale`) para no depender del backend y
 * poder inspeccionar las llamadas.
 *
 * Cubre:
 *  - Modo create: typing → submit → create.mutateAsync con eurosToCents
 *  - Validación: campos vacíos disparan mensajes en español
 *  - Modo edit: pre-rellena con centsToEuros; submit → update.mutateAsync
 *  - Errores de la mutation se muestran al usuario
 */
import { describe, expect, it, vi, type Mock } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock de los hooks (hoisted antes de los imports dinámicos).
vi.mock('@/hooks/useCreateSale', () => ({
  useCreateSale: vi.fn(),
}));
vi.mock('@/hooks/useUpdateSale', () => ({
  useUpdateSale: vi.fn(),
}));

import { useCreateSale } from '@/hooks/useCreateSale';
import { useUpdateSale } from '@/hooks/useUpdateSale';
import { SaleForm } from '@/components/sales/SaleForm';
import { renderWithProviders } from '@/test-utils/render';
import { saleFixture } from '@/test-utils/fixtures';
import { ApiError } from '@/api/client';

/**
 * Devuelve un objeto con la forma mínima que `SaleForm` consume del
 * resultado de `useMutation`. El form usa `mutateAsync`, `isPending` y
 * `data`/`error`. Para mantener el tipado simple usamos `as unknown as`.
 */
function makeMutationResult(mutateAsync: Mock) {
  return {
    mutateAsync,
    mutate: mutateAsync,
    isPending: false,
    isError: false,
    isSuccess: false,
    isIdle: true,
    status: 'idle',
    data: undefined,
    error: null,
    reset: vi.fn(),
    variables: undefined,
    failureCount: 0,
    failureReason: null,
    context: undefined,
    submittedAt: 0,
  };
}

describe('SaleForm', () => {
  describe('modo create', () => {
    it('typing + submit llama a create.mutateAsync con eurosToCents', async () => {
      const user = userEvent.setup();
      const createMutateAsync = vi.fn().mockResolvedValue(saleFixture);
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm />);

      await user.type(screen.getByLabelText('Producto *'), 'iPhone 12');
      await user.type(screen.getByLabelText('Comprador'), 'Juan');
      await user.clear(screen.getByLabelText('Coste (€)'));
      await user.type(screen.getByLabelText('Coste (€)'), '150');
      await user.clear(screen.getByLabelText('Precio de venta (€)'));
      await user.type(screen.getByLabelText('Precio de venta (€)'), '250');
      await user.clear(screen.getByLabelText('Costes asociados (€)'));
      await user.type(screen.getByLabelText('Costes asociados (€)'), '5');
      await user.click(screen.getByLabelText(/Ya lo vendí/));

      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(createMutateAsync).toHaveBeenCalledTimes(1);
      });

      // Payload: cost_cents 15000 (150€), price_cents 25000 (250€),
      // associated_costs_cents 500 (5€), sold true, buyer_name 'Juan'.
      const payload = createMutateAsync.mock.calls[0]?.[0];
      expect(payload.product_name).toBe('iPhone 12');
      expect(payload.buyer_name).toBe('Juan');
      expect(payload.cost_cents).toBe(15000);
      expect(payload.price_cents).toBe(25000);
      expect(payload.associated_costs_cents).toBe(500);
      expect(payload.sold).toBe(true);
    });

    it('campos vacíos disparan mensajes de error en español', async () => {
      const user = userEvent.setup();
      const createMutateAsync = vi.fn();
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm />);

      // Submit sin tocar nada → product_name vacío.
      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(screen.getByText('El producto es obligatorio')).toBeInTheDocument();
      });
      expect(createMutateAsync).not.toHaveBeenCalled();
    });

    it('product_name con más de 200 chars falla', async () => {
      const user = userEvent.setup();
      const createMutateAsync = vi.fn();
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm />);
      await user.type(screen.getByLabelText('Producto *'), 'x'.repeat(201));
      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(screen.getByText(/Máximo 200 caracteres/)).toBeInTheDocument();
      });
      expect(createMutateAsync).not.toHaveBeenCalled();
    });
  });

  describe('modo edit', () => {
    it('pre-rellena campos con centsToEuros(sale.cost_cents)', () => {
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm sale={saleFixture} />);

      // 15000 cents = 150; 25000 cents = 250; 500 cents = 5
      const costInput = screen.getByLabelText('Coste (€)') as HTMLInputElement;
      const priceInput = screen.getByLabelText('Precio de venta (€)') as HTMLInputElement;
      const assocInput = screen.getByLabelText('Costes asociados (€)') as HTMLInputElement;

      expect(costInput.value).toBe('150');
      expect(priceInput.value).toBe('250');
      expect(assocInput.value).toBe('5');

      // Botón cambia a "Guardar cambios"
      expect(screen.getByRole('button', { name: /Guardar cambios/ })).toBeInTheDocument();
    });

    it('submit llama a update.mutateAsync con { id, input }', async () => {
      const user = userEvent.setup();
      const updateMutateAsync = vi.fn().mockResolvedValue(saleFixture);
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(updateMutateAsync) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm sale={saleFixture} />);

      // Cambio el precio y guardo.
      await user.clear(screen.getByLabelText('Precio de venta (€)'));
      await user.type(screen.getByLabelText('Precio de venta (€)'), '300');

      await user.click(screen.getByRole('button', { name: /Guardar cambios/ }));

      await waitFor(() => {
        expect(updateMutateAsync).toHaveBeenCalledTimes(1);
      });

      const args = updateMutateAsync.mock.calls[0]?.[0] as { id: number; input: { price_cents: number } };
      expect(args.id).toBe(saleFixture.id);
      expect(args.input.price_cents).toBe(30000); // 300€ → 30000 cents
    });

    it('checkbox sold refleja el estado de la venta', () => {
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm sale={saleFixture} />);
      const checkbox = screen.getByLabelText(/Ya lo vendí/) as HTMLInputElement;
      expect(checkbox.checked).toBe(true);
    });
  });

  describe('manejo de errores', () => {
    it('error de la mutation se muestra en <p> rojo', async () => {
      const user = userEvent.setup();
      const apiError = new ApiError(400, {
        error: 'Datos inválidos',
        issues: [{ path: 'product_name', message: 'obligatorio' }],
      });
      const createMutateAsync = vi.fn().mockRejectedValue(apiError);
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm />);

      await user.type(screen.getByLabelText(/Producto/), 'X');
      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(screen.getByText('Datos inválidos')).toBeInTheDocument();
      });
      // El contenedor del error tiene la clase roja.
      const errorContainer = screen.getByText('Datos inválidos').closest('p');
      expect(errorContainer?.className).toMatch(/text-red-700/);
    });

    it('error de red muestra "Error de red" (envuelto por apiFetch)', async () => {
      const user = userEvent.setup();
      const netError = new ApiError(0, { error: 'Error de red' });
      const createMutateAsync = vi.fn().mockRejectedValue(netError);
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm />);

      await user.type(screen.getByLabelText(/Producto/), 'X');
      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(screen.getByText('Error de red')).toBeInTheDocument();
      });
    });
  });

  describe('navegación tras éxito', () => {
    it('corre el path de éxito cuando no hay onSuccess', async () => {
      // MemoryRouter no actualiza window.location.pathname, así que no
      // podemos verificar la navegación directamente. Verificamos que la
      // mutación corrió (lo que prueba que la rama de éxito del form
      // ejecutó, que es la que llama a navigate('/')).
      const user = userEvent.setup();
      const createMutateAsync = vi.fn().mockResolvedValue(saleFixture);
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm />, { route: '/sales/new' });

      await user.type(screen.getByLabelText('Producto *'), 'X');
      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(createMutateAsync).toHaveBeenCalledTimes(1);
      });
    });

    it('usa onSuccess en lugar de navigate cuando está provisto', async () => {
      const user = userEvent.setup();
      const onSuccess = vi.fn();
      const createMutateAsync = vi.fn().mockResolvedValue(saleFixture);
      vi.mocked(useCreateSale).mockReturnValue(
        makeMutationResult(createMutateAsync) as unknown as ReturnType<typeof useCreateSale>,
      );
      vi.mocked(useUpdateSale).mockReturnValue(
        makeMutationResult(vi.fn()) as unknown as ReturnType<typeof useUpdateSale>,
      );

      renderWithProviders(<SaleForm onSuccess={onSuccess} />, { route: '/sales/new' });

      await user.type(screen.getByLabelText('Producto *'), 'X');
      await user.click(screen.getByRole('button', { name: /Crear venta/ }));

      await waitFor(() => {
        expect(onSuccess).toHaveBeenCalledWith(saleFixture);
      });
      // Si onSuccess fue llamado, navigate NO se llamó (el form hace una
      // u otra, no ambas).
    });
  });
});