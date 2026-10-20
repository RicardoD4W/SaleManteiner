/**
 * Buscador client-side de las páginas /buys y /solds.
 *
 * Es un módulo PURO (sin React, sin DOM) para que se pueda testear sin
 * montar componentes: parseo de la query + matching contra una fila.
 *
 * Gramática (decidida por el orquestador del feature):
 *  - Un único input de texto. La query se parte por espacios en tokens.
 *  - Una fila coincide si TODOS los tokens coinciden (AND).
 *
 * Clasificación de cada token, EN ESTE ORDEN:
 *  1. Número con signo  /^[+-]\d+(?:[.,]\d+)?$/   → solo columna Beneficio (/solds).
 *  2. Cantidad          /^[x×]\d+$/i             → solo columna de cantidad.
 *  3. Fecha             dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd → columnas de fecha.
 *  4. Número simple     /^\d+(?:[.,]\d+)*$/       → cualquier columna numérica
 *     (valor exacto) + substring de algún nombre (para que "iphone 12" funcione).
 *  5. Texto libre       → substring de algún nombre (sin distinguir mayúsculas
 *     ni acentos).
 *
 * Los filtros se derivan de las columnas que cada tabla tiene: /solds tiene
 * columna "Beneficio", así que un token con signo ("+3") matchea SOLO esa
 * columna; /buys NO la tiene, así que el signo no tiene columna destino y
 * degrada a número simple (matchea Coste, Cantidad, Asociados o Disponibles).
 *
 * Los importes se comparan con `round2()` (ver `lib/round.ts`) para que el
 * error IEEE 754 no produzca falsos negativos (0.1 + 0.2 vs 0.3).
 */
import type { BuyWithStock } from '../api/buys.js';
import type { SoldWithProfit } from '../api/solds.js';
import { round2 } from './round.js';

// ── Tipos ────────────────────────────────────────────────────────────

/**
 * Una fila normalizada para la búsqueda. `item` es la fila original (la que
 * se le pasa a TanStack Table); el resto son las "columnas" por las que se
 * puede filtrar.
 */
export interface SearchRow<T> {
  /** La fila original. */
  item: T;
  /** Nombres de la fila (producto y/o cliente). */
  names: string[];
  /** Fechas de la fila en `YYYY-MM-DD`. */
  dates: string[];
  /** Valores de las columnas numéricas (importes, cantidades, stock). */
  numbers: number[];
  /** Valores de la(s) columna(s) de cantidad (token `x2`). */
  quantities: number[];
  /** Beneficio de la fila. Solo existe en /solds (columna "Beneficio"). */
  profit?: number;
}

/** Venta con el nombre del cliente resuelto (lo arma la página de /solds). */
export interface SoldWithCustomer extends SoldWithProfit {
  customerName: string;
}

/** Un token de la query ya clasificado. */
export type SearchToken =
  | { kind: 'signed'; raw: string; value: number }
  | { kind: 'quantity'; raw: string; value: number }
  | { kind: 'date'; raw: string; value: string }
  | { kind: 'number'; raw: string; value: number }
  | { kind: 'text'; raw: string; value: string };

// ── Regex (hoisted: se crean una sola vez, ver skill react-best-practices) ──

/** 1. Número con signo: "+3", "-1", "-12,50", "-1.234,56". */
const SIGNED_NUMBER_RE = /^[+-]\d+(?:[.,]\d+)*$/;
/** 2. Cantidad: "x2", "X3", "×4". */
const QUANTITY_RE = /^[x×]\d+$/i;
/**
 * 3. Fecha: dd/mm/yyyy, dd-mm-yyyy, dd.mm.yyyy y yyyy-mm-dd.
 *
 * Se acepta el punto como separador (es el formato natural en español) pero
 * el MISMO separador en los dos primeros grupos ("24.09.2026" sí, "24/09.2026"
 * no). "1.234" sigue siendo un número: el mes 234 no es una fecha válida.
 */
const DATE_PART_RE = /^(\d{1,2})([./-])(\d{1,2})\2(\d{2,4})$/;
/** 3. Fecha ISO: "2026-10-05". */
const DATE_ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
/**
 * 4. Número simple: "12", "12,50", "12.50", "1.234,56".
 * Se permiten varios grupos separadores (uno por miles + uno decimal);
 * si el parseo no da un número válido, el token cae a texto libre.
 */
const NUMBER_RE = /^\d+(?:[.,]\d+)*$/;
/** Marcas combinantes (acentos) para la normalización de texto. */
const COMBINING_MARKS_RE = /[\u0300-\u036f]/g;

// ── Helpers de texto ─────────────────────────────────────────────────

/**
 * Normaliza texto para comparar: minúsculas + sin diacríticos.
 * "José Pérez" → "jose perez".
 */
export function normalizeText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(COMBINING_MARKS_RE, '');
}

/** Parte de fecha `YYYY-MM-DD` de un string ISO (fecha o datetime). */
function datePart(value: string): string {
  return value.slice(0, 10);
}

// ── Parseo ───────────────────────────────────────────────────────────

/**
 * Parsea un número escrito por el usuario a `number`.
 *
 * Acepta: "12", "12,50", "12.50", "1.234,56", "1234.56", "12,50€", "1.234,56 €".
 * Regla:
 *  - Se quitan "€" y espacios.
 *  - Si hay "." y "," a la vez, el ÚLTIMO separador es el decimal y el otro
 *    es de miles.
 *  - Si hay un solo separador, es decimal si le siguen 1 o 2 dígitos; si no,
 *    es separador de miles.
 *
 * Devuelve `null` si el texto no es un número.
 */
export function parseNumber(raw: string): number | null {
  let text = raw.replace(/[€\s]/g, '');
  if (text === '') return null;

  const lastDot = text.lastIndexOf('.');
  const lastComma = text.lastIndexOf(',');

  if (lastDot >= 0 && lastComma >= 0) {
    // Hay ambos separadores: el último es el decimal.
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
      // Separador de miles: "1.234" → 1234.
      text = text.split(sep).join('');
    }
  }

  const parsed = Number(text);
  return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Parsea una fecha escrita por el usuario a `YYYY-MM-DD`.
 *
 * Acepta "yyyy-mm-dd" (directo), "dd/mm/yyyy", "dd-mm-yyyy" y "dd/mm/yy".
 * Para años de 2 dígitos se usa el pivote habitual: 00-49 → 2000-2049,
 * 50-99 → 1950-1999.
 *
 * Devuelve `null` si no es una fecha válida.
 */
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

/**
 * Parte la query en tokens clasificados. Query vacía → array vacío
 * (que significa "todas las filas coinciden").
 */
export function parseSearchQuery(query: string): SearchToken[] {
  // El "€" se quita antes de partir: "1.234,56 €" debe ser un token
  // ("1.234,56") y no dos ("1.234,56" + "€").
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

// ── Matching ─────────────────────────────────────────────────────────

/**
 * ¿El importe de una columna coincide con el número buscado?
 *
 * - Coincidencia exacta (redondeada a 2 decimales): "56,15" encuentra 56,15 €.
 * - Si la query es un ENTERO, alcanza con que coincida la parte entera:
 *   "56" encuentra "56,15 €" (que es lo que el usuario escribe al ver la
 *   columna) pero NO encuentra "25" ni "560,00".
 * - Si la query trae decimales, el match exacto es el único válido: "56,15"
 *   no encuentra "56,99".
 */
export function matchesNumber(value: number, query: number): boolean {
  if (round2(value) === round2(query)) return true;
  if (!Number.isInteger(query)) return false;
  return Math.trunc(value) === query;
}

/** ¿El token coincide con la fila? */
export function matchesToken(row: SearchRow<unknown>, token: SearchToken): boolean {
  switch (token.kind) {
    case 'signed':
      // Solo la columna Beneficio (existe únicamente en /solds). El signo
      // es exacto: "+56" no matchea un beneficio de -56.
      return row.profit !== undefined && matchesNumber(row.profit, token.value);

    case 'quantity':
      // Solo la columna de cantidad (coincidencia exacta: son enteros).
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
      // Exhaustividad: si se agrega un tipo de token y no se maneja acá,
      // el compilador lo marca.
      const _exhaustive: never = token;
      return _exhaustive;
    }
  }
}

/** ¿La fila coincide con TODOS los tokens? */
export function matchesQuery(row: SearchRow<unknown>, tokens: SearchToken[]): boolean {
  return tokens.every((token) => matchesToken(row, token));
}

// ── Extracción por fila ──────────────────────────────────────────────

/**
 * Normaliza una compra (/buys) para la búsqueda.
 * Columnas: Producto, Coste (€), Cantidad, Asociados (€), Fecha compra,
 * Disponibles.
 */
export function toBuySearchRow(buy: BuyWithStock): SearchRow<BuyWithStock> {
  return {
    item: buy,
    names: [buy.product_name],
    dates: buy.purchase_date ? [datePart(buy.purchase_date)] : [],
    numbers: [buy.purchase_cost, buy.associated_costs, buy.quantity, buy.disponibles],
    quantities: [buy.quantity],
  };
}

/**
 * Normaliza una venta (/solds) para la búsqueda.
 * Columnas: Fecha (sold_at), Registrado (created_at), Cliente, Productos,
 * Precio (€), Asociados (€), Beneficio.
 */
export function toSoldSearchRow(sold: SoldWithCustomer): SearchRow<SoldWithCustomer> {
  const dates: string[] = [];
  if (sold.sold_at) dates.push(datePart(sold.sold_at));
  if (sold.created_at) dates.push(datePart(sold.created_at));

  const names: string[] = [sold.customerName];
  const numbers: number[] = [sold.sale_price, sold.associated_costs];
  const quantities: number[] = [];

  // El Beneficio es una columna numérica más: un número simple lo matchea
  // por valor ABSOLUTO ("56" encuentra "56,15 €" y "-56,15 €"). El signo
  // lo distingue el token con signo ("+56,15" / "-56,15"), que sí exige
  // coincidencia exacta.
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

// ── Filtrado ─────────────────────────────────────────────────────────

/** Filtra filas ya normalizadas por los tokens. Sin tokens → todas las filas. */
function filterRowsByTokens<T>(rows: SearchRow<T>[], tokens: SearchToken[]): SearchRow<T>[] {
  if (tokens.length === 0) return rows;
  return rows.filter((row) => matchesQuery(row, tokens));
}

/**
 * Filtra filas ya normalizadas por la query. Query vacía → todas las filas.
 */
export function filterSearchRows<T>(rows: SearchRow<T>[], query: string): SearchRow<T>[] {
  return filterRowsByTokens(rows, parseSearchQuery(query));
}

/**
 * Filtra compras por la query (helper para la página /buys).
 *
 * OJO: /buys NO tiene columna "Beneficio", así que un token con signo ("+3")
 * no tiene columna destino. En vez de no matchear nada, degrada a número
 * simple: los filtros se derivan de las columnas que cada tabla tiene.
 */
export function filterBuys(buys: BuyWithStock[], query: string): BuyWithStock[] {
  const tokens = parseSearchQuery(query).map((token) =>
    token.kind === 'signed'
      ? ({ kind: 'number', raw: token.raw, value: token.value } as const)
      : token,
  );
  return filterRowsByTokens(buys.map(toBuySearchRow), tokens).map((row) => row.item);
}

/** Filtra ventas por la query (helper para la página /solds). */
export function filterSolds(solds: SoldWithCustomer[], query: string): SoldWithCustomer[] {
  return filterSearchRows(solds.map(toSoldSearchRow), query).map((row) => row.item);
}
