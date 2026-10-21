/**
 * Tests del borrado de clientes (S3 y S4 del feature `clientes-crud`).
 *
 * Cubre:
 *  - El type guard estricto `isDeleteCustomer409`: un 409 SOLO cuenta como
 *    "ventas asociadas" si además trae `associated_sales` con contenido.
 *    Es la lección de S11 (feature `delete-cascade-and-ux-polish`): si el
 *    guard fuera laxo, un 409 sin lista abriría una modal de cascada
 *    vacía y el error del server no se mostraría nunca.
 *  - `useDeleteCustomer` (borrado simple): llama al DELETE correcto,
 *    invalida la caché y avisa con un toast.
 *  - `useDeleteCustomerCascade` (borrado en cascada): llama al endpoint
 *    `/:id/cascade`, invalida `['customers']`, `['solds']` y
 *    `['stats','dashboard']` y avisa con un toast.
 *  - El toast de edición (`useUpdateCustomer`) vive en su propio archivo de
 *    test (`useUpdateCustomer.test.tsx`), junto al hook que lo dispara.
 *
 * Mockeamos `customersApi` para no depender del backend.
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/api/customers', () => ({
  customersApi: {
    list: vi.fn(),
    getById: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    remove: vi.fn(),
    removeCascade: vi.fn(),
    search: vi.fn(),
  },
}));

const { toastEliminado, toastActualizado, toastRegistrado } = vi.hoisted(() => ({
  toastEliminado: vi.fn(),
  toastActualizado: vi.fn(),
  toastRegistrado: vi.fn(),
}));
vi.mock('@/lib/toast', () => ({ toastEliminado, toastActualizado, toastRegistrado }));

import { customersApi } from '@/api/customers';
import { ApiError } from '@/api/client';
import {
  isDeleteCustomer409,
  useDeleteCustomer,
  useDeleteCustomerCascade,
  type AssociatedCustomerSale,
} from '@/hooks/useDeleteCustomer';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

const SALES: AssociatedCustomerSale[] = [
  { id: 7, customer_name: 'Ana', sold_at: '2026-10-19', items_count: 2 },
];

const customerFixture = {
  id: 1,
  name: 'Juan Pérez',
  created_at: '2026-10-01T10:00:00.000Z',
};

describe('isDeleteCustomer409', () => {
  it('true: 409 con associated_sales no vacío', () => {
    const body = {
      error:
        'No se puede borrar: el cliente tiene ventas asociadas. ¿Querés borrar también las ventas?',
      associated_sales: SALES,
    };
    expect(isDeleteCustomer409(new ApiError(409, body))).toBe(true);
  });

  it('false: 409 sin associated_sales (no debe abrir la modal en silencio)', () => {
    const err = new ApiError(409, { error: 'Conflicto' });
    expect(isDeleteCustomer409(err)).toBe(false);
  });

  it('false: 409 con associated_sales vacío (no hay nada que confirmar)', () => {
    const body = { error: 'Conflicto', associated_sales: [] };
    expect(isDeleteCustomer409(new ApiError(409, body))).toBe(false);
  });

  it('false: 409 con associated_sales que no es un array', () => {
    const body = { error: 'Conflicto', associated_sales: 'nope' };
    expect(isDeleteCustomer409(new ApiError(409, body))).toBe(false);
  });

  it('false: otros status (404, 500)', () => {
    expect(isDeleteCustomer409(new ApiError(404, { error: 'Cliente no encontrado' }))).toBe(false);
    expect(isDeleteCustomer409(new ApiError(500, { error: 'Internal Server Error' }))).toBe(false);
  });

  it('false: errores que no son ApiError', () => {
    expect(isDeleteCustomer409(new Error('boom'))).toBe(false);
    expect(isDeleteCustomer409('boom')).toBe(false);
    expect(isDeleteCustomer409(undefined)).toBe(false);
  });
});

describe('useDeleteCustomer', () => {
  beforeEach(() => {
    vi.mocked(customersApi.remove).mockReset();
    toastEliminado.mockClear();
  });

  it('llama a customersApi.remove con el id', async () => {
    vi.mocked(customersApi.remove).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(customersApi.remove).toHaveBeenCalledTimes(1);
    expect(customersApi.remove).toHaveBeenCalledWith(3);
  });

  it('en éxito invalida ["customers"] y los KPIs del dashboard', async () => {
    vi.mocked(customersApi.remove).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('en éxito avisa con un toast de cliente eliminado', async () => {
    vi.mocked(customersApi.remove).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      expect(toastEliminado).toHaveBeenCalledWith('cliente');
    });
  });

  it('propaga el error si customersApi.remove rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(customersApi.remove).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(3)).rejects.toBe(boom);
  });

  it('NO invalida queries ni avisa si la mutación falla', async () => {
    vi.mocked(customersApi.remove).mockRejectedValueOnce(new Error('boom'));
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteCustomer(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync(3);
      } catch {
        // expected
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toastEliminado).not.toHaveBeenCalled();
  });
});

describe('useDeleteCustomerCascade', () => {
  beforeEach(() => {
    vi.mocked(customersApi.removeCascade).mockReset();
    toastEliminado.mockClear();
  });

  it('llama a customersApi.removeCascade con el id', async () => {
    vi.mocked(customersApi.removeCascade).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteCustomerCascade(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    expect(customersApi.removeCascade).toHaveBeenCalledTimes(1);
    expect(customersApi.removeCascade).toHaveBeenCalledWith(3);
  });

  it('en éxito invalida ["customers"], ["solds"] y los KPIs del dashboard', async () => {
    vi.mocked(customersApi.removeCascade).mockResolvedValueOnce(undefined);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useDeleteCustomerCascade(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      // El cliente desapareció de la lista.
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      // Sus ventas desaparecieron (y con ellas, sus items).
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['solds'] });
      // El dashboard muestra topBuyers con el nombre del cliente.
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('en éxito avisa con un toast de cliente eliminado', async () => {
    vi.mocked(customersApi.removeCascade).mockResolvedValueOnce(undefined);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteCustomerCascade(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync(3);
    });

    await waitFor(() => {
      expect(toastEliminado).toHaveBeenCalledWith('cliente');
    });
  });

  it('propaga el error si customersApi.removeCascade rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(customersApi.removeCascade).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useDeleteCustomerCascade(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync(3)).rejects.toBe(boom);
  });
});

describe('toasts de clientes (S4)', () => {
  beforeEach(() => {
    vi.mocked(customersApi.update).mockReset();
    toastActualizado.mockClear();
    toastRegistrado.mockClear();
  });

  // OJO: el test del toast de EDICIÓN vive en `useUpdateCustomer.test.tsx`
  // (allí está el hook que lo dispara).

  it('el alta ya tiene su propio toast (no se duplica)', async () => {
    // `useCreateCustomer` dispara `toastRegistrado` por su cuenta: el
    // borrado y la edición no pueden disparar también el de alta.
    const { useCreateCustomer } = await import('@/hooks/useCreateCustomer');
    vi.mocked(customersApi.create).mockResolvedValueOnce(customerFixture as never);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useCreateCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Juan Pérez' });
    });

    await waitFor(() => {
      expect(toastRegistrado).toHaveBeenCalledTimes(1);
    });
    expect(toastActualizado).not.toHaveBeenCalled();
  });
});
