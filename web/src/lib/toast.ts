import { sileo } from 'sileo';

export type ToastKind = 'buy' | 'sale' | 'customer';

const TITLES = {
  buy: {
    created: 'Compra registrada',
    updated: 'Compra actualizada',
    deleted: 'Compra eliminada',
  },
  sale: {
    created: 'Venta registrada',
    updated: 'Venta actualizada',
    deleted: 'Venta eliminada',
  },
  customer: {
    created: 'Cliente registrado',
    updated: 'Cliente actualizado',
    deleted: 'Cliente eliminado',
  },
} satisfies Record<ToastKind, { created: string; updated: string; deleted: string }>;

function show(title: string, description?: string): void {
  sileo.success({
    ...(description ? { description: description } : {}),
    title: title,
    styles: { title: 'normal-case!' },
  });
}

export function toastCreated(kind: ToastKind, description?: string): void {
  show(TITLES[kind].created, description);
}

export function toastUpdated(kind: ToastKind, description?: string): void {
  show(TITLES[kind].updated, description);
}

export function toastDeleted(kind: ToastKind, description?: string): void {
  show(TITLES[kind].deleted, description);
}

export function toastBackupCreated(description?: string): void {
  sileo.success({
    ...(description ? { description: description } : {}),
    title: 'Copia de seguridad creada',
    styles: { title: 'normal-case!' },
  });
}

export function toastBackupDeleted(): void {
  sileo.success({
    title: 'Copia de seguridad eliminada',
    styles: { title: 'normal-case!' },
  });
}

export function toastBackupRestored(description?: string): void {
  sileo.success({
    ...(description ? { description: description } : {}),
    title: 'Copia restaurada',
    styles: { title: 'normal-case!' },
  });
}
