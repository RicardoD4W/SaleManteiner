import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatEuro, todayLocalDate } from '../format.js';

describe('formatEuro', () => {
  it('formatea 0 como "0,00 €"', () => {
    expect(formatEuro(0)).toBe('0,00\u00A0€');
  });

  it('formatea 12.5 como "12,50 €"', () => {
    expect(formatEuro(12.5)).toBe('12,50\u00A0€');
  });

  it('formatea importes grandes con separador de miles es-ES', () => {
    expect(formatEuro(12345.67)).toBe('12.345,67\u00A0€');
  });

  it('formatea números negativos (Intl los soporta)', () => {
    expect(formatEuro(-0.5)).toBe('-0,50\u00A0€');
  });

  it('formatea con dos decimales aunque el número traiga más', () => {
    expect(formatEuro(12.499)).toBe('12,50\u00A0€');
  });

  it('formatea sin romper por la coma flotante (0.1 + 0.2)', () => {
    expect(formatEuro(0.1 + 0.2)).toBe('0,30\u00A0€');
  });
});

describe('formatDate', () => {
  it('formatea ISO 8601 UTC a dd/MM/yyyy (TZ=UTC)', () => {
    expect(formatDate('2026-10-16T00:00:00.000Z')).toBe('16/10/2026');
  });

  it('formatea otro día del mismo año', () => {
    expect(formatDate('2026-01-01T12:00:00.000Z')).toBe('01/01/2026');
  });

  it('devuelve un guion largo cuando la fecha es null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('devuelve un guion largo cuando la fecha es una cadena vacía', () => {
    expect(formatDate('')).toBe('—');
  });
});

describe('todayLocalDate', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('devuelve el día local en formato YYYY-MM-DD', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 9, 16));
    expect(todayLocalDate()).toBe('2026-10-16');
  });

  it('rellena con ceros a la izquierda el mes y el día', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 5));
    expect(todayLocalDate()).toBe('2026-01-05');
  });

  it('usa el día local, no el UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 30, 23, 30));
    expect(todayLocalDate()).toBe('2026-09-30');
  });
});
