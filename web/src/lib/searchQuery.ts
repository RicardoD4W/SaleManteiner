import type { BuyWithStock } from '../api/buys.js';
import type { SoldWithProfit } from '../api/solds.js';
import { round2 } from './round.js';

interface SearchRow<T> {
  item: T;

  names: string[];

  dates: string[];

  numbers: number[];

  quantities: number[];

  profit?: number;
}

export interface SoldWithCustomer extends SoldWithProfit {
  customerName: string;
}

type SearchToken =
  | { kind: 'signed'; raw: string; value: number }
  | { kind: 'quantity'; raw: string; value: number }
  | { kind: 'date'; raw: string; value: string }
  | { kind: 'number'; raw: string; value: number }
  | { kind: 'text'; raw: string; value: string };

const SIGNED_NUMBER_RE = /^[+-]\d+(?:[.,]\d+)*$/;

const QUANTITY_RE = /^[x×]\d+$/i;

const DATE_PART_RE = /^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})$/;

const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

const NUMBER_RE = /^\d+(?:[.,]\d+)*$/;

const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(COMBINING_MARKS_RE, '');
}

function datePart(value: string): string {
  return value.slice(0, 10);
}

export function parseNumber(raw: string): number | null {
  let text = raw.replace(/[€\s]/g, '');
  if (text === '') return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    const decimalSep = lastDot > lastComma ? '.' : ',';
    const thousandsSep = decimalSep === '.' ? ',' : '.';
    text = text.split(thousandsSep).join('');
    text = text.replace(decimalSep, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const decimals = text.length - text.lastIndexOf(sep) - 1;
    if (decimals === 1 || decimals === 2) {
      text = text.replace(sep, '.');
    } else {
      text = text.split(sep).join('');
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseDate(raw: string): string | null {
  if (DATE_ISO_RE.test(raw)) return raw;

  const match = DATE_PART_RE.exec(raw);
  if (!match) return null;

  const day = Number(match[1]);
  const month = Number(match[3]);
  let year = Number(match[4]);
  if (year < 100) year += year >= 50 ? 1900 : 2000;

  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

export function parseSearchQuery(query: string): SearchToken[] {
  const cleaned = query.replace(/€/g, '');
  const rawTokens = cleaned.split(/\s+/).filter((t) => t.length > 0);

  const tokens: SearchToken[] = [];
  for (const raw of rawTokens) {
    if (SIGNED_NUMBER_RE.test(raw)) {
      const value = parseNumber(raw);
      if (value !== null) {
        tokens.push({ kind: 'signed', raw, value });
        continue;
      }
    }

    if (QUANTITY_RE.test(raw)) {
      tokens.push({ kind: 'quantity', raw, value: Number(raw.slice(1)) });
      continue;
    }

    const date = parseDate(raw);
    if (date !== null) {
      tokens.push({ kind: 'date', raw, value: date });
      continue;
    }

    if (NUMBER_RE.test(raw)) {
      const value = parseNumber(raw);
      if (value !== null) {
        tokens.push({ kind: 'number', raw, value });
        continue;
      }
    }

    tokens.push({ kind: 'text', raw, value: normalizeText(raw) });
  }

  return tokens;
}

export function matchesNumber(value: number, query: number): boolean {
  if (round2(value) === round2(query)) return true;
  if (!Number.isInteger(query)) return false;
  return Math.trunc(value) === query;
}

function matchesToken(row: SearchRow<unknown>, token: SearchToken): boolean {
  switch (token.kind) {
    case 'signed':
      return row.profit !== undefined && matchesNumber(row.profit, token.value);

    case 'quantity':
      return row.quantities.some((q) => q === token.value);

    case 'date':
      return row.dates.includes(token.value);

    case 'number':
      return (
        row.numbers.some((n) => matchesNumber(n, token.value)) ||
        row.names.some((name) => normalizeText(name).includes(normalizeText(token.raw)))
      );

    case 'text':
      return row.names.some((name) => normalizeText(name).includes(token.value));

    default: {
      const _exhaustive: never = token;
      return _exhaustive;
    }
  }
}

function matchesQuery(row: SearchRow<unknown>, tokens: SearchToken[]): boolean {
  return tokens.every((token) => matchesToken(row, token));
}

export function toBuySearchRow(buy: BuyWithStock): SearchRow<BuyWithStock> {
  return {
    item: buy,
    names: [buy.product_name],
    dates: buy.purchase_date ? [datePart(buy.purchase_date)] : [],
    numbers: [buy.purchase_cost, buy.associated_costs, buy.quantity, buy.disponibles],
    quantities: [buy.quantity],
  };
}

export function toSoldSearchRow(sold: SoldWithCustomer): SearchRow<SoldWithCustomer> {
  const dates: string[] = [];
  if (sold.sold_at) dates.push(datePart(sold.sold_at));
  if (sold.created_at) dates.push(datePart(sold.created_at));

  const names: string[] = [sold.customerName];
  const numbers: number[] = [sold.sale_price, sold.associated_costs];
  const quantities: number[] = [];

  numbers.push(Math.abs(sold.profit));

  for (const item of sold.items) {
    names.push(item.product_name);
    numbers.push(item.quantity);
    quantities.push(item.quantity);
  }

  return {
    item: sold,
    names,
    dates,
    numbers,
    quantities,
    profit: sold.profit,
  };
}

function filterRowsByTokens<T>(rows: SearchRow<T>[], tokens: SearchToken[]): SearchRow<T>[] {
  if (tokens.length === 0) return rows;
  return rows.filter((row) => matchesQuery(row, tokens));
}

function filterSearchRows<T>(rows: SearchRow<T>[], query: string): SearchRow<T>[] {
  return filterRowsByTokens(rows, parseSearchQuery(query));
}

export function filterBuys(buys: BuyWithStock[], query: string): BuyWithStock[] {
  const tokens = parseSearchQuery(query).map((token) =>
    token.kind === 'signed'
      ? ({ kind: 'number', raw: token.raw, value: token.value } as const)
      : token,
  );
  return filterRowsByTokens(buys.map(toBuySearchRow), tokens).map((row) => row.item);
}

export function filterSolds<T extends SoldWithCustomer>(solds: T[], query: string): T[] {
  return filterSearchRows(solds.map(toSoldSearchRow), query).map((row) => row.item as T);
}
