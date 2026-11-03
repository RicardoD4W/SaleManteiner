import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatEuro, formatPhone, todayLocalDate } from '../format.js';

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

describe('formatPhone', () => {
  it('devuelve una cadena vacía cuando no hay teléfono', () => {
    expect(formatPhone('')).toBe('');
  });

  it('devuelve una cadena vacía cuando el teléfono es null', () => {
    expect(formatPhone(null)).toBe('');
  });

  it('devuelve una cadena vacía cuando el teléfono es undefined', () => {
    expect(formatPhone(undefined)).toBe('');
  });

  it('agrupa 9 dígitos de tres en tres', () => {
    expect(formatPhone('612345678')).toBe('612 345 678');
  });

  it('mete los dígitos sobrantes en el último grupo', () => {
    expect(formatPhone('6123456789')).toBe('612 345 6789');
  });

  it('agrupa 12 dígitos en cuatro grupos de tres', () => {
    expect(formatPhone('612345678901')).toBe('612 345 678 901');
  });

  it('ignora espacios y guiones de la entrada', () => {
    expect(formatPhone('612 34 56-78')).toBe('612 345 678');
  });

  it('ignora letras y símbolos', () => {
    expect(formatPhone('+34 612 34 56 78')).toBe('346 123 45678');
  });

  it('devuelve una cadena vacía si la entrada no tiene dígitos', () => {
    expect(formatPhone('---')).toBe('');
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
