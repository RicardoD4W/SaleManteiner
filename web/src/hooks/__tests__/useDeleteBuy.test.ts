/**
 * Tests del type guard `isDeleteBuy409` (S11 del feature
 * `delete-cascade-and-ux-polish`).
 *
 * Contexto: el guard solo miraba `status === 409`. Si el server devolvía un
 * 409 sin `associated_sales` (o con la lista vacía), la UI abría la modal de
 * cascada con `associated_sales === undefined`, la modal no se renderizaba
 * (porque el JSX la condiciona a `deleteCascadeOpen && associatedSales`) y
 * NO se mostraba ningún error: el click en "Eliminar" no hacía nada.
 */
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../api/client';
import { isDeleteBuy409, type AssociatedSale } from '../useDeleteBuy';

const SALES: AssociatedSale[] = [
  { id: 7, customer_name: 'Ana', sold_at: '2026-10-19', items_count: 2 },
];

describe('isDeleteBuy409', () => {
  it('true: 409 con associated_sales no vacío', () => {
    const body = {
      error: 'No se puede borrar: la compra tiene ventas asociadas. ¿Querés borrar también las ventas?',
      associated_sales: SALES,
    };
    expect(isDeleteBuy409(new ApiError(409, body))).toBe(true);
  });

  it('false: 409 sin associated_sales (no debe abrir la modal en silencio)', () => {
    const err = new ApiError(409, { error: 'Conflicto' });
    expect(isDeleteBuy409(err)).toBe(false);
  });

  it('false: 409 con associated_sales vacío (no hay nada que confirmar)', () => {
    const body = { error: 'Conflicto', associated_sales: [] };
    expect(isDeleteBuy409(new ApiError(409, body))).toBe(false);
  });

  it('false: 409 con associated_sales que no es un array', () => {
    const body = { error: 'Conflicto', associated_sales: 'nope' };
    expect(isDeleteBuy409(new ApiError(409, body))).toBe(false);
  });

  it('false: otros status (404, 500)', () => {
    expect(isDeleteBuy409(new ApiError(404, { error: 'Compra no encontrada' }))).toBe(false);
    expect(isDeleteBuy409(new ApiError(500, { error: 'Internal Server Error' }))).toBe(false);
  });

  it('false: errores que no son ApiError', () => {
    expect(isDeleteBuy409(new Error('boom'))).toBe(false);
    expect(isDeleteBuy409('boom')).toBe(false);
    expect(isDeleteBuy409(undefined)).toBe(false);
  });
});
