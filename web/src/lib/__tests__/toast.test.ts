/**
 * Tests del helper de toasts.
 *
 * Mockeamos `sileo` para comprobar los literales sin montar el `<Toaster>`.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { success } = vi.hoisted(() => ({ success: vi.fn() }));

vi.mock('sileo', () => ({ sileo: { success } }));

import { toastActualizado, toastEliminado, toastRegistrado } from '../toast.js';

describe('toast', () => {
  beforeEach(() => {
    success.mockClear();
  });

  it('avisa del alta con su literal y la descripción', () => {
    toastRegistrado('compra', 'Funda iPhone');
    expect(success).toHaveBeenCalledWith({
      title: 'Compra registrada',
      description: 'Funda iPhone',
      // sileo capitaliza el título; se anula (en español no se capitaliza).
      styles: { title: 'normal-case!' },
    });
  });

  it('avisa de la edición con su literal', () => {
    toastActualizado('venta');
    expect(success).toHaveBeenCalledWith({
      title: 'Venta actualizada',
      styles: { title: 'normal-case!' },
    });
  });

  it('avisa del borrado con su literal y la descripción', () => {
    toastEliminado('cliente', 'Ana Ruiz');
    expect(success).toHaveBeenCalledWith({
      title: 'Cliente eliminado',
      description: 'Ana Ruiz',
      styles: { title: 'normal-case!' },
    });
  });
});
