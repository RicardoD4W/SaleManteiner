import { describe, expect, it, vi, type Mock } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { ApiError } from '../../api/client';
import type { AssociatedSale } from '../../api/types';
import { isCascadeConflict, useCascadeDeleteFlow } from '../useCascadeDeleteFlow';

const SALES: AssociatedSale[] = [
  { id: 7, customer_name: 'Ana', sold_at: '2026-10-19', items_count: 2 },
];

const cuerpo409 = { error: 'Conflicto', associated_sales: SALES };

describe('isCascadeConflict', () => {
  it('true: 409 con associated_sales no vacío', () => {
    const body = {
      error:
        'No se puede borrar: la compra tiene ventas asociadas. ¿Querés borrar también las ventas?',
      associated_sales: SALES,
    };
    expect(isCascadeConflict(new ApiError(409, body))).toBe(true);
  });

  it('false: 409 sin associated_sales (no debe abrir la modal en silencio)', () => {
    const err = new ApiError(409, { error: 'Conflicto' });
    expect(isCascadeConflict(err)).toBe(false);
  });

  it('false: 409 con associated_sales vacío (no hay nada que confirmar)', () => {
    const body = { error: 'Conflicto', associated_sales: [] };
    expect(isCascadeConflict(new ApiError(409, body))).toBe(false);
  });

  it('false: 409 con associated_sales que no es un array', () => {
    const body = { error: 'Conflicto', associated_sales: 'nope' };
    expect(isCascadeConflict(new ApiError(409, body))).toBe(false);
  });

  it('false: otros status (404, 500)', () => {
    expect(isCascadeConflict(new ApiError(404, { error: 'No encontrada' }))).toBe(false);
    expect(isCascadeConflict(new ApiError(500, { error: 'Internal Server Error' }))).toBe(false);
  });

  it('false: errores que no son ApiError', () => {
    expect(isCascadeConflict(new Error('boom'))).toBe(false);
    expect(isCascadeConflict('boom')).toBe(false);
    expect(isCascadeConflict(undefined)).toBe(false);
  });
});

type MutationMock = (id: number) => Promise<unknown>;

function montarFlujo(opciones: {
  deleteOne?: Mock<MutationMock>;
  deleteCascade?: Mock<MutationMock>;
  onClose?: () => void;
  id?: number | null;
  resetKey?: string | number | null;
}) {
  const deleteOne = {
    mutateAsync: opciones.deleteOne ?? vi.fn<MutationMock>().mockResolvedValue(undefined),
    isPending: false,
  };
  const deleteCascade = {
    mutateAsync: opciones.deleteCascade ?? vi.fn<MutationMock>().mockResolvedValue(undefined),
    isPending: false,
  };
  const onClose = opciones.onClose ?? vi.fn();

  const view = renderHook(
    (props: { id: number | null; resetKey: string | number | null }) =>
      useCascadeDeleteFlow({
        id: props.id,
        resetKey: props.resetKey,
        deleteOne,
        deleteCascade,
        onClose,
      }),
    { initialProps: { id: opciones.id ?? 1, resetKey: opciones.resetKey ?? '1' } },
  );

  return { ...view, deleteOne, deleteCascade, onClose };
}

describe('useCascadeDeleteFlow', () => {
  it('un 409 con ventas abre el flujo de cascada con la lista de ventas', async () => {
    const deleteOne = vi.fn<MutationMock>().mockRejectedValue(new ApiError(409, cuerpo409));
    const { result } = montarFlujo({ deleteOne });

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.inCascade).toBe(true);
    expect(result.current.associatedSales).toEqual(SALES);
    expect(result.current.error).toBeNull();
  });

  it('un error que no es 409 se muestra como error y no abre la cascada', async () => {
    const deleteOne = vi
      .fn<MutationMock>()
      .mockRejectedValue(new ApiError(500, { error: 'Se rompió' }));
    const { result } = montarFlujo({ deleteOne });

    await act(async () => {
      await result.current.confirm();
    });

    expect(result.current.inCascade).toBe(false);
    expect(result.current.error).toBe('Se rompió');
  });

  it('al borrar bien se cierra el diálogo', async () => {
    const onClose = vi.fn();
    const { result } = montarFlujo({ onClose });

    await act(async () => {
      await result.current.confirm();
    });

    expect(onClose).toHaveBeenCalled();
  });

  it('el error de la cascada se muestra aparte del error del borrado simple', async () => {
    const deleteCascade = vi
      .fn<MutationMock>()
      .mockRejectedValue(new ApiError(500, { error: 'Cascada rota' }));
    const { result } = montarFlujo({ deleteCascade });

    await act(async () => {
      await result.current.confirmCascade();
    });

    expect(result.current.cascadeError).toBe('Cascada rota');
    expect(result.current.error).toBeNull();
  });

  it('cambiar de objetivo reinicia el flujo', async () => {
    const deleteOne = vi.fn<MutationMock>().mockRejectedValue(new ApiError(409, cuerpo409));
    const { result, rerender } = montarFlujo({ deleteOne });

    await act(async () => {
      await result.current.confirm();
    });
    expect(result.current.inCascade).toBe(true);

    rerender({ id: 2, resetKey: '2' });

    await waitFor(() => {
      expect(result.current.inCascade).toBe(false);
    });
    expect(result.current.associatedSales).toBeNull();
  });
});
