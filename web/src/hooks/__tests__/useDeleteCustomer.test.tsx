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

const { toastDeleted, toastUpdated, toastCreated } = vi.hoisted(() => ({
  toastDeleted: vi.fn(),
  toastUpdated: vi.fn(),
  toastCreated: vi.fn(),
}));
vi.mock('@/lib/toast', () => ({ toastDeleted, toastUpdated, toastCreated }));

import { customersApi } from '@/api/customers';
import { useDeleteCustomer, useDeleteCustomerCascade } from '@/hooks/useDeleteCustomer';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

const customerFixture = {
  id: 1,
  name: 'Juan Pérez',
  created_at: '2026-10-01T10:00:00.000Z',
};

describe('useDeleteCustomer', () => {
  beforeEach(() => {
    vi.mocked(customersApi.remove).mockReset();
    toastDeleted.mockClear();
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
      expect(toastDeleted).toHaveBeenCalledWith('customer');
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
        return;
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
    expect(toastDeleted).not.toHaveBeenCalled();
  });
});

describe('useDeleteCustomerCascade', () => {
  beforeEach(() => {
    vi.mocked(customersApi.removeCascade).mockReset();
    toastDeleted.mockClear();
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
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['solds'] });
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
      expect(toastDeleted).toHaveBeenCalledWith('customer');
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
    toastUpdated.mockClear();
    toastCreated.mockClear();
  });

  it('el alta ya tiene su propio toast (no se duplica)', async () => {
    const { useCreateCustomer } = await import('@/hooks/useCreateCustomer');
    vi.mocked(customersApi.create).mockResolvedValueOnce(customerFixture as never);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useCreateCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ name: 'Juan Pérez' });
    });

    await waitFor(() => {
      expect(toastCreated).toHaveBeenCalledTimes(1);
    });
    expect(toastUpdated).not.toHaveBeenCalled();
  });
});
