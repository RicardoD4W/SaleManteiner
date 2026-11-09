export type ArmedTarget = 'edit' | 'receipt';

export function soldVtName(field: string, soldId: number): string {
  return `sold-${field}-${soldId}`;
}

export function soldItemVtName(buyId: number, soldId: number): string {
  return `sold-item-${buyId}-name-${soldId}`;
}
