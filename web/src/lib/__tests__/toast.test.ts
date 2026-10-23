import { beforeEach, describe, expect, it, vi } from 'vitest';

const { success } = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock('sileo', () => ({ sileo: { success } }));

import { toastUpdated, toastDeleted, toastCreated } from '../toast.js';

describe('toast', () => {
  beforeEach(() => {
    success.mockClear();
  });

  it('avisa del alta con su literal y la descripción', () => {
    toastCreated('buy', 'Funda iPhone');
    expect(success).toHaveBeenCalledWith({
      title: 'Compra registrada',
      description: 'Funda iPhone',
      styles: { title: 'normal-case!' },
    });
  });

  it('avisa de la edición con su literal', () => {
    toastUpdated('sale');
    expect(success).toHaveBeenCalledWith({
      title: 'Venta actualizada',
      styles: { title: 'normal-case!' },
    });
  });

  it('avisa del borrado con su literal y la descripción', () => {
    toastDeleted('customer', 'Ana Ruiz');
    expect(success).toHaveBeenCalledWith({
      title: 'Cliente eliminado',
      description: 'Ana Ruiz',
      styles: { title: 'normal-case!' },
    });
  });
});
