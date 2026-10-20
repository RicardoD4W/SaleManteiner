/**
 * Tests del buscador client-side (/buys y /solds).
 *
 * Cubre la gramática decided por el orquestador:
 *  - token con signo → solo Beneficio
 *  - token "x2" → solo columna de cantidad
 *  - token de fecha (dd/mm/yyyy, dd-mm-yyyy, yyyy-mm-dd) → columnas de fecha
 *  - token numérico → cualquier columna numérica (+ substring de nombres)
 *  - texto libre → substring de nombres (sin mayúsculas ni acentos)
 *  - varios tokens → AND
 *  - query vacía → todas las filas
 */
import { describe, it, expect } from 'vitest';
import {
  filterBuys,
  filterSolds,
  matchesNumber,
  parseDate,
  parseNumber,
  parseSearchQuery,
  toBuySearchRow,
  toSoldSearchRow,
  type SoldWithCustomer,
} from '../searchQuery.js';
import type { BuyWithStock } from '../../api/buys.js';

// ── Fixtures ─────────────────────────────────────────────────────────

const buyA: BuyWithStock = {
  id: 1,
  product_name: 'Funda iPhone 12',
  purchase_cost: 50,
  quantity: 10,
  associated_costs: 5,
  purchase_date: '2026-09-28',
  created_at: '2026-10-01T10:00:00.000Z',
  disponibles: 8,
};

const buyB: BuyWithStock = {
  id: 2,
  product_name: 'Cargador USB-C',
  purchase_cost: 30,
  quantity: 3,
  associated_costs: 0,
  purchase_date: '2026-10-05',
  created_at: '2026-10-05T09:00:00.000Z',
  disponibles: 3,
};

const soldA: SoldWithCustomer = {
  id: 10,
  customer_id: 1,
  customerName: 'José Pérez',
  sale_price: 1234.56,
  associated_costs: 12.5,
  sold_at: '2026-10-05',
  notes: null,
  created_at: '2026-10-06T09:30:00.000Z',
  profit: 30,
  items: [
    { buy_id: 1, product_name: 'Funda iPhone 12', quantity: 2, unit_cost: 5, unit_assoc: 0.5 },
    { buy_id: 2, product_name: 'Cargador USB-C', quantity: 1, unit_cost: 10, unit_assoc: 0 },
  ],
};

const soldB: SoldWithCustomer = {
  id: 11,
  customer_id: 2,
  customerName: 'Ana Ruiz',
  sale_price: 40,
  associated_costs: 0,
  sold_at: null,
  notes: null,
  created_at: '2026-10-07T18:00:00.000Z',
  profit: -1,
  items: [{ buy_id: 2, product_name: 'Cargador USB-C', quantity: 3, unit_cost: 10, unit_assoc: 0 }],
};

// ── Helpers ──────────────────────────────────────────────────────────

const ids = (rows: BuyWithStock[]): number[] => rows.map((b) => b.id);
const soldIds = (rows: SoldWithCustomer[]): number[] => rows.map((s) => s.id);

// ── Tests ────────────────────────────────────────────────────────────

describe('parseNumber', () => {
  it('parsea números simples y decimales', () => {
    expect(parseNumber('12')).toBe(12);
    expect(parseNumber('12,50')).toBe(12.5);
    expect(parseNumber('12.50')).toBe(12.5);
    expect(parseNumber('12.5')).toBe(12.5);
  });

  it('parsea separadores de miles', () => {
    expect(parseNumber('1.234,56')).toBe(1234.56);
    expect(parseNumber('1234.56')).toBe(1234.56);
    expect(parseNumber('1.234')).toBe(1234);
    expect(parseNumber('1,234')).toBe(1234);
  });

  it('quita el símbolo € y los espacios', () => {
    expect(parseNumber('12,50€')).toBe(12.5);
    expect(parseNumber('1.234,56 €')).toBe(1234.56);
  });

  it('devuelve null si no es un número', () => {
    expect(parseNumber('iphone')).toBeNull();
    expect(parseNumber('')).toBeNull();
  });
});

describe('parseDate', () => {
  it('acepta yyyy-mm-dd', () => {
    expect(parseDate('2026-10-05')).toBe('2026-10-05');
  });

  it('convierte dd/mm/yyyy y dd-mm-yyyy', () => {
    expect(parseDate('05/10/2026')).toBe('2026-10-05');
    expect(parseDate('05-10-2026')).toBe('2026-10-05');
    expect(parseDate('5/10/2026')).toBe('2026-10-05');
  });

  it('acepta años de 2 dígitos', () => {
    expect(parseDate('05/10/26')).toBe('2026-10-05');
    expect(parseDate('05/10/99')).toBe('1999-10-05');
  });

  it('acepta el punto como separador de fecha', () => {
    expect(parseDate('24.09.2026')).toBe('2026-09-24');
    // Separadores mezclados: no es una fecha.
    expect(parseDate('24/09.2026')).toBeNull();
    // "1.234" sigue siendo un número (el mes 234 no existe).
    expect(parseDate('1.234')).toBeNull();
  });

  it('devuelve null si no es una fecha válida', () => {
    expect(parseDate('32/01/2026')).toBeNull();
    expect(parseDate('10/2026')).toBeNull();
  });
});

describe('matchesNumber', () => {
  it('coincidencia exacta (redondeada a 2 decimales)', () => {
    expect(matchesNumber(56.15, 56.15)).toBe(true);
    expect(matchesNumber(1234.56, 1234.56)).toBe(true);
    expect(matchesNumber(0.1 + 0.2, 0.3)).toBe(true);
  });

  it('un entero busca por parte entera', () => {
    expect(matchesNumber(56.15, 56)).toBe(true);
    expect(matchesNumber(56, 56)).toBe(true);
    expect(matchesNumber(25, 2)).toBe(false);
    expect(matchesNumber(560, 56)).toBe(false);
  });

  it('con decimales, solo el match exacto', () => {
    expect(matchesNumber(56.99, 56.15)).toBe(false);
    expect(matchesNumber(56.15, 56.15)).toBe(true);
  });
});

describe('parseSearchQuery', () => {
  it('clasifica cada tipo de token', () => {
    expect(parseSearchQuery('+3')).toEqual([{ kind: 'signed', raw: '+3', value: 3 }]);
    expect(parseSearchQuery('-1')).toEqual([{ kind: 'signed', raw: '-1', value: -1 }]);
    expect(parseSearchQuery('x2')).toEqual([{ kind: 'quantity', raw: 'x2', value: 2 }]);
    expect(parseSearchQuery('×3')).toEqual([{ kind: 'quantity', raw: '×3', value: 3 }]);
    expect(parseSearchQuery('05/10/2026')).toEqual([
      { kind: 'date', raw: '05/10/2026', value: '2026-10-05' },
    ]);
    expect(parseSearchQuery('12,50')).toEqual([{ kind: 'number', raw: '12,50', value: 12.5 }]);
    expect(parseSearchQuery('iphone')).toEqual([{ kind: 'text', raw: 'iphone', value: 'iphone' }]);
  });

  it('parte por espacios y quita el €', () => {
    const tokens = parseSearchQuery('iphone 12,50€');
    expect(tokens).toHaveLength(2);
    expect(tokens[0]?.kind).toBe('text');
    expect(tokens[1]).toEqual({ kind: 'number', raw: '12,50', value: 12.5 });
  });

  it('devuelve tokens vacíos para una query vacía', () => {
    expect(parseSearchQuery('')).toEqual([]);
    expect(parseSearchQuery('   ')).toEqual([]);
  });
});

describe('filterBuys', () => {
  const buys = [buyA, buyB];

  it('query vacía devuelve todas las filas', () => {
    expect(filterBuys(buys, '')).toHaveLength(2);
    expect(filterBuys(buys, '   ')).toHaveLength(2);
  });

  it('filtra por texto libre (sin distinguir mayúsculas ni acentos)', () => {
    expect(ids(filterBuys(buys, 'iphone'))).toEqual([1]);
    expect(ids(filterBuys(buys, 'IPHONE'))).toEqual([1]);
    expect(ids(filterBuys(buys, 'cargador'))).toEqual([2]);
  });

  it('filtra por cantidad de la columna Cantidad (x2)', () => {
    expect(ids(filterBuys(buys, 'x3'))).toEqual([2]);
    expect(ids(filterBuys(buys, 'x2'))).toEqual([]);
  });

  it('filtra por columnas numéricas (valor exacto)', () => {
    expect(ids(filterBuys(buys, '50'))).toEqual([1]); // purchase_cost
    expect(ids(filterBuys(buys, '8'))).toEqual([1]); // disponibles
    expect(ids(filterBuys(buys, '30'))).toEqual([2]); // purchase_cost
  });

  it('un número también matchea como substring de un nombre', () => {
    expect(ids(filterBuys(buys, '12'))).toEqual([1]); // "Funda iPhone 12"
  });

  it('filtra por fecha de compra (dd/mm/yyyy)', () => {
    expect(ids(filterBuys(buys, '28/09/2026'))).toEqual([1]);
    expect(ids(filterBuys(buys, '05-10-2026'))).toEqual([2]);
    expect(ids(filterBuys(buys, '2026-09-28'))).toEqual([1]);
  });

  it('combina tokens con AND', () => {
    expect(ids(filterBuys(buys, 'iphone 12'))).toEqual([1]);
    expect(ids(filterBuys(buys, 'iphone x10'))).toEqual([1]);
    expect(ids(filterBuys(buys, 'iphone x3'))).toEqual([]);
  });

  it('en /buys el token con signo degrada a número simple (no hay columna Beneficio)', () => {
    // /buys no tiene columna "Beneficio": el signo no tiene columna destino,
    // así que "+3" se comporta como "3" (matchea cualquier columna numérica:
    // Coste, Cantidad, Asociados o Disponibles).
    expect(ids(filterBuys(buys, '+3'))).toEqual([2]); // Cantidad y Disponibles de buyB
    expect(ids(filterBuys(buys, '+50'))).toEqual([1]); // Coste de buyA
  });

  it('filtra por la columna Disponibles', () => {
    // 8 solo aparece en la columna Disponibles de buyA (coste 50, cantidad 10,
    // asociados 5).
    expect(ids(filterBuys(buys, '8'))).toEqual([1]);
  });
});

describe('filterSolds', () => {
  const solds = [soldA, soldB];

  it('query vacía devuelve todas las filas', () => {
    expect(filterSolds(solds, '')).toHaveLength(2);
  });

  it('filtra por nombre de cliente (sin acentos)', () => {
    expect(soldIds(filterSolds(solds, 'jose'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, 'Pérez'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, 'ana'))).toEqual([11]);
  });

  it('filtra por nombre de producto de cualquier item', () => {
    expect(soldIds(filterSolds(solds, 'funda'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, 'usb-c'))).toEqual([10, 11]);
  });

  it('filtra por cantidad de cualquier item (x2)', () => {
    expect(soldIds(filterSolds(solds, 'x2'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, 'x3'))).toEqual([11]);
  });

  it('filtra por columnas numéricas (precio, asociados, cantidad de item)', () => {
    expect(soldIds(filterSolds(solds, '1234,56'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, '1.234,56'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, '40'))).toEqual([11]);
    expect(soldIds(filterSolds(solds, '12,50'))).toEqual([10]);
  });

  it('un número simple matchea la columna Beneficio (por valor absoluto)', () => {
    // soldA: beneficio +30; soldB: beneficio -1.
    expect(soldIds(filterSolds(solds, '30'))).toEqual([10]);
    // "1" matchea a soldA (cantidad de un item) y a soldB (|beneficio| = 1).
    expect(soldIds(filterSolds(solds, '1'))).toEqual([10, 11]);
  });

  it('un número entero matchea por parte entera ("56" -> "56,15 €")', () => {
    // El usuario ve "56,15 €" en la columna y escribe "56": tiene que
    // encontrar la fila. Pero "56" NO matchea "25" ni "560".
    expect(soldIds(filterSolds(solds, '1234'))).toEqual([10]); // parte entera de 1234,56
    expect(soldIds(filterSolds(solds, '12'))).toEqual([10]); // parte entera de 12,50
    expect(soldIds(filterSolds(solds, '4'))).toEqual([]); // 40 no es 4
    expect(soldIds(filterSolds(solds, '1235'))).toEqual([]); // ni una unidad más
  });

  it('un número con decimales exige coincidencia exacta', () => {
    // "56,15" encuentra 56,15 pero no 56,99.
    expect(soldIds(filterSolds(solds, '12,50'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, '12,99'))).toEqual([]);
  });

  it('filtra por Beneficio con número con signo', () => {
    expect(soldIds(filterSolds(solds, '+30'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, '-1'))).toEqual([11]);
    expect(soldIds(filterSolds(solds, '+1'))).toEqual([]);
  });

  it('el token con signo NO matchea otras columnas numéricas', () => {
    // soldB tiene associated_costs 0 y precio 40; "+40" solo puede ser Beneficio.
    expect(soldIds(filterSolds(solds, '+40'))).toEqual([]);
  });

  it('filtra por Fecha (sold_at) y por Registrado (created_at)', () => {
    expect(soldIds(filterSolds(solds, '05/10/2026'))).toEqual([10]); // sold_at
    expect(soldIds(filterSolds(solds, '07/10/2026'))).toEqual([11]); // created_at
  });

  it('combina tokens con AND', () => {
    expect(soldIds(filterSolds(solds, 'jose +30'))).toEqual([10]);
    expect(soldIds(filterSolds(solds, 'jose x3'))).toEqual([]);
    expect(soldIds(filterSolds(solds, 'ana x3'))).toEqual([11]);
  });
});

describe('helpers de extracción', () => {
  it('toBuySearchRow extrae nombres, fechas, números y cantidades', () => {
    const row = toBuySearchRow(buyA);
    expect(row.item).toBe(buyA);
    expect(row.names).toEqual(['Funda iPhone 12']);
    expect(row.dates).toEqual(['2026-09-28']);
    expect(row.numbers).toEqual([50, 5, 10, 8]);
    expect(row.quantities).toEqual([10]);
    expect(row.profit).toBeUndefined();
  });

  it('toSoldSearchRow extrae los items, el cliente y el beneficio', () => {
    const row = toSoldSearchRow(soldA);
    expect(row.item).toBe(soldA);
    expect(row.names).toEqual(['José Pérez', 'Funda iPhone 12', 'Cargador USB-C']);
    expect(row.dates).toEqual(['2026-10-05', '2026-10-06']);
    expect(row.numbers).toEqual([1234.56, 12.5, 30, 2, 1]);
    expect(row.quantities).toEqual([2, 1]);
    expect(row.profit).toBe(30);
  });

  it('toSoldSearchRow tolera sold_at null', () => {
    const row = toSoldSearchRow(soldB);
    expect(row.dates).toEqual(['2026-10-07']);
  });
});
