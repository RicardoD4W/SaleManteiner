/**
 * Avisos (toasts) de las acciones de compras, ventas y clientes.
 *
 * Usa la librería `sileo` (toasts con morphing SVG y física de resorte).
 * Un único punto de entrada para que los literales de los avisos vivan
 * juntos y no se repitan hook por hook.
 *
 * Spec: `odd/tasks/feature-toasts-sileo.md` (S1, S3).
 */
import { sileo } from 'sileo';

/** Tipo de registro al que se refiere un aviso. */
export type ToastTipo = 'compra' | 'venta' | 'cliente';

/** Literales de cada aviso, por tipo de registro. */
const TITULOS = {
  compra: {
    registrado: 'Compra registrada',
    actualizado: 'Compra actualizada',
    eliminado: 'Compra eliminada',
  },
  venta: {
    registrado: 'Venta registrada',
    actualizado: 'Venta actualizada',
    eliminado: 'Venta eliminada',
  },
  cliente: {
    registrado: 'Cliente registrado',
    actualizado: 'Cliente actualizado',
    eliminado: 'Cliente eliminado',
  },
} satisfies Record<ToastTipo, { registrado: string; actualizado: string; eliminado: string }>;

/** Dispara un toast de éxito con título y (opcional) descripción. */
function mostrar(titulo: string, descripcion?: string): void {
  sileo.success({
    ...(descripcion ? { description: descripcion } : {}),
    title: titulo,
    // sileo aplica `text-transform: capitalize` al título ("Compra
    // Registrada"). En español cada palabra no se capitaliza, así que se
    // anula con la variante `!` de Tailwind (que gana en especificidad).
    styles: { title: 'normal-case!' },
  });
}

/** Aviso de éxito al registrar (crear) un registro. */
export function toastRegistrado(tipo: ToastTipo, descripcion?: string): void {
  mostrar(TITULOS[tipo].registrado, descripcion);
}

/** Aviso de éxito al editar un registro. */
export function toastActualizado(tipo: ToastTipo, descripcion?: string): void {
  mostrar(TITULOS[tipo].actualizado, descripcion);
}

/** Aviso de éxito al borrar un registro. */
export function toastEliminado(tipo: ToastTipo, descripcion?: string): void {
  mostrar(TITULOS[tipo].eliminado, descripcion);
}
