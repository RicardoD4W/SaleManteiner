import { describe, expect, it } from 'vitest';
import { centsToEuros, eurosToCents, formatCents, formatDate, formatDateTime } from '../format.js';

describe('formatCents', () => {
  it('formatea 0 como "0,00\u00A0€"', () => {
    expect(formatCents(0)).toBe('0,00\u00A0€');
  });

  it('formatea 1250 como "12,50\u00A0€"', () => {
    expect(formatCents(1250)).toBe('12,50\u00A0€');
  });

  it('formatea importes grandes con separador de miles es-ES', () => {
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
    expect(eurosToCents(0.1 + 0.2)).toBe(30);
  });

  it('redondea 0.005 hacia arriba (Math.round half-up)', () => {
    expect(eurosToCents(0.005)).toBe(1);
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
