import { formatDate } from './format.js';
import { round2 } from './round.js';
import type { SaleItemOutput } from '../schemas/solds.js';

export interface ReceiptLine {
  key: string;
  buyId: number;
  productName: string;
  quantity: number;
}

export interface ReceiptTotals {
  total: number;
  paid: number | null;
  pending: number;
}

export function receiptLines(items: SaleItemOutput[]): ReceiptLine[] {
  return items.map((item) => ({
    key: String(item.buy_id),
    buyId: item.buy_id,
    productName: item.product_name,
    quantity: item.quantity,
  }));
}

export function receiptTotals(
  salePrice: number,
  paidAmount: number | null | undefined,
): ReceiptTotals {
  const total = round2(salePrice);
  if (paidAmount === null || paidAmount === undefined) {
    return { total, paid: null, pending: 0 };
  }
  const paid = round2(paidAmount);
  return { total, paid, pending: round2(total - paid) };
}

export function receiptDate(soldAt: string | null | undefined, createdAt: string): string {
  return formatDate(soldAt ?? createdAt);
}

export function receiptFileName(
  soldId: number,
  soldAt: string | null | undefined,
  createdAt: string,
): string {
  return `Factura Nº${soldId} - ${receiptDate(soldAt, createdAt).replace(/\//g, '-')}`;
}
