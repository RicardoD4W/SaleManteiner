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

const { toastUpdated } = vi.hoisted(() => ({ toastUpdated: vi.fn() }));
vi.mock('@/lib/toast', () => ({ toastUpdated }));

import { customersApi } from '@/api/customers';
import { useUpdateCustomer } from '@/hooks/useUpdateCustomer';
import { makeHookWrapper } from '@/test-utils/hook-wrapper';

const customerFixture = {
  id: 1,
  name: 'Juan Pérez',
  created_at: '2026-10-01T10:00:00.000Z',
};

describe('useUpdateCustomer', () => {
  beforeEach(() => {
    vi.mocked(customersApi.update).mockReset();
    toastUpdated.mockClear();
  });

  it('llama a customersApi.update con el id y el input', async () => {
    vi.mocked(customersApi.update).mockResolvedValueOnce(customerFixture as never);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useUpdateCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, input: { name: 'Juan Pérez' } });
    });

    expect(customersApi.update).toHaveBeenCalledTimes(1);
    expect(customersApi.update).toHaveBeenCalledWith(1, { name: 'Juan Pérez' });
  });

  it('en éxito invalida ["customers"] y los KPIs del dashboard', async () => {
    vi.mocked(customersApi.update).mockResolvedValueOnce(customerFixture as never);
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, input: { name: 'Juan Pérez' } });
    });

    await waitFor(() => {
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['customers'] });
      expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['stats', 'dashboard'] });
    });
  });

  it('propaga el error si customersApi.update rechaza', async () => {
    const boom = new Error('boom');
    vi.mocked(customersApi.update).mockRejectedValueOnce(boom);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useUpdateCustomer(), { wrapper: Wrapper });

    await expect(result.current.mutateAsync({ id: 1, input: { name: 'Juan Pérez' } })).rejects.toBe(
      boom,
    );
  });

  it('NO invalida queries si la mutación falla', async () => {
    vi.mocked(customersApi.update).mockRejectedValueOnce(new Error('boom'));
    const { qc, Wrapper } = makeHookWrapper();
    const invalidateSpy = vi.spyOn(qc, 'invalidateQueries');

    const { result } = renderHook(() => useUpdateCustomer(), { wrapper: Wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: 1, input: { name: 'Juan Pérez' } });
      } catch {
        return;
      }
    });

    expect(invalidateSpy).not.toHaveBeenCalled();
  });

  it('avisa con un toast de cliente actualizado (con el nombre)', async () => {
    vi.mocked(customersApi.update).mockResolvedValueOnce(customerFixture as never);
    const { Wrapper } = makeHookWrapper();
    const { result } = renderHook(() => useUpdateCustomer(), { wrapper: Wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: 1, input: { name: 'Juan Pérez' } });
    });

    await waitFor(() => {
      expect(toastUpdated).toHaveBeenCalledWith('customer', 'Juan Pérez');
    });
  });
});
