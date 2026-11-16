import { round2 } from '../lib/round.js';
import { EuroMoney } from '../schemas/common.js';
import { InvalidBackupError } from './backup-errors.js';

export interface BackupRowBundle {
  customers: string[];
  buys: string[];
  solds: string[];
  saleItems: string[];
  categories: string[];
  expenses: string[];
  tags: string[];
}

type Row = Record<string, unknown>;

function parseRow(raw: string, table: string): Row {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new InvalidBackupError(
      `La copia no se puede restaurar: hay una fila ilegible en ${table}`,
    );
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new InvalidBackupError(
      `La copia no se puede restaurar: hay una fila ilegible en ${table}`,
    );
  }
  return parsed as Row;
}

function rowLabel(table: string, row: Row): string {
  const id = row.id;
  return typeof id === 'number' ? `${table} #${id}` : table;
}

function moneyProblem(value: unknown): boolean {
  if (typeof value !== 'number' || !Number.isFinite(value)) return true;
  if (value < 0) return true;
  return !EuroMoney.safeParse(value).success;
}

function moneyValue(row: Row, field: string, label: string, table: string): number {
  const value = row[field];
  if (moneyProblem(value)) {
    throw new InvalidBackupError(
      `La copia no se puede restaurar: ${rowLabel(table, row)} tiene ${label} no válido (${String(value)})`,
    );
  }
  return round2(value as number);
}

function quantityValue(row: Row, field: string, table: string): number {
  const value = row[field];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new InvalidBackupError(
      `La copia no se puede restaurar: ${rowLabel(table, row)} tiene una cantidad no válida (${String(value)})`,
    );
  }
  return value;
}

function normalizeBuy(raw: string): string {
  const row = parseRow(raw, 'la tabla de compras');
  row.purchase_cost = moneyValue(row, 'purchase_cost', 'un precio de compra', 'la compra');
  row.associated_costs = moneyValue(
    row,
    'associated_costs',
    'un importe de gastos asociados',
    'la compra',
  );
  row.quantity = quantityValue(row, 'quantity', 'la compra');
  return JSON.stringify(row);
}

function normalizeSold(raw: string): string {
  const row = parseRow(raw, 'la tabla de ventas');
  const salePrice = moneyValue(row, 'sale_price', 'un precio de venta', 'la venta');
  row.sale_price = salePrice;
  row.associated_costs = moneyValue(
    row,
    'associated_costs',
    'un importe de gastos asociados',
    'la venta',
  );
  const paid = row.paid_amount;
  if (paid !== null && paid !== undefined) {
    const paidValue = moneyValue(row, 'paid_amount', 'un importe cobrado', 'la venta');
    if (paidValue > salePrice) {
      throw new InvalidBackupError(
        `La copia no se puede restaurar: ${rowLabel('la venta', row)} tiene un importe cobrado mayor que el precio de venta`,
      );
    }
    row.paid_amount = paidValue;
  }
  return JSON.stringify(row);
}

function normalizeSaleItem(raw: string): string {
  const row = parseRow(raw, 'la tabla de los ítems vendidos');
  row.quantity = quantityValue(row, 'quantity', 'el ítem de la venta');
  return JSON.stringify(row);
}

function normalizeExpense(raw: string): string {
  const row = parseRow(raw, 'la tabla de gastos');
  row.amount = moneyValue(row, 'amount', 'un importe', 'el gasto');
  return JSON.stringify(row);
}

export function normalizeBackupRows(rows: BackupRowBundle): BackupRowBundle {
  return {
    customers: rows.customers,
    buys: rows.buys.map(normalizeBuy),
    solds: rows.solds.map(normalizeSold),
    saleItems: rows.saleItems.map(normalizeSaleItem),
    categories: rows.categories,
    expenses: rows.expenses.map(normalizeExpense),
    tags: rows.tags,
  };
}
