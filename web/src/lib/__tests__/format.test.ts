/**
 * Tests de formatters de moneda y fecha.
 *
 * Importante: `formatDate`/`formatDateTime` usan `Intl.DateTimeFormat('es-ES')`,
 * que formatea en la zona horaria local. Para que los tests sean deterministas
 * independiente del entorno (CI UTC, dev en otra TZ), el script `test` setea
 * `TZ=UTC` vía cross-env (ver web/package.json).
 */
import { describe, expect, it } from 'vitest';
import { centsToEuros, eurosToCents, formatCents, formatDate, formatDateTime } from '../format.js';

describe('formatCents', () => {
  it('formatea 0 como "0,00\u00A0€"', () => {
    // \u00A0 = NBSP. Intl.NumberFormat usa NBSP entre número y símbolo €.
    expect(formatCents(0)).toBe('0,00\u00A0€');
  });

  it('formatea 1250 como "12,50\u00A0€"', () => {
    expect(formatCents(1250)).toBe('12,50\u00A0€');
  });

  it('formatea importes grandes con separador de miles es-ES', () => {
    // 1234567 cents = 12345.67 €
    expect(formatCents(1234567)).toBe('12.345,67\u00A0€');
  });

  it('formatea números negativos (Intl los soporta)', () => {
    expect(formatCents(-50)).toBe('-0,50\u00A0€');
  });
});

describe('centsToEuros', () => {
  it('divide por 100', () => {
    expect(centsToEuros(1250)).toBe(12.5);
    expect(centsToEuros(0)).toBe(0);
    expect(centsToEuros(100)).toBe(1);
  });

  it('es la inversa exacta de eurosToCents para enteros', () => {
    expect(centsToEuros(eurosToCents(12.5))).toBe(12.5);
    expect(centsToEuros(eurosToCents(99.99))).toBe(99.99);
  });
});

describe('eurosToCents', () => {
  it('multiplica por 100 y redondea', () => {
    expect(eurosToCents(12.5)).toBe(1250);
    expect(eurosToCents(0)).toBe(0);
  });

  it('rompe el caso clásico de float 0.1 + 0.2', () => {
    // 0.1 + 0.2 === 0.30000000000000004
    // eurosToCents debe redondear a 30, no a 29 ni a 31.
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });

  it('redondea 0.005 hacia arriba (Math.round half-up)', () => {
    // 0.005 * 100 = 0.5, Math.round(0.5) === 1 (banker's rounding NO,
    // Math.round de JS es round-half-away-from-zero para positivos).
    expect(eurosToCents(0.005)).toBe(1);
    // 0.004 * 100 = 0.4 → Math.round(0.4) === 0
    expect(eurosToCents(0.004)).toBe(0);
  });
});

describe('formatDate', () => {
  it('formatea ISO 8601 UTC a dd/MM/yyyy (TZ=UTC)', () => {
    expect(formatDate('2026-10-16T00:00:00.000Z')).toBe('16/10/2026');
  });

  it('formatea otro día del mismo año', () => {
    expect(formatDate('2026-01-01T12:00:00.000Z')).toBe('01/01/2026');
  });
});

describe('formatDateTime', () => {
  it('formatea ISO 8601 UTC a dd/MM/yyyy, HH:mm (TZ=UTC)', () => {
    expect(formatDateTime('2026-10-16T22:34:00.000Z')).toBe('16/10/2026, 22:34');
  });

  it('padded con ceros a la izquierda', () => {
    expect(formatDateTime('2026-01-01T00:05:00.000Z')).toBe('01/01/2026, 00:05');
  });
});
