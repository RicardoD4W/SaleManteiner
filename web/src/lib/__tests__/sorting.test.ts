import { describe, expect, it } from 'vitest';
import { compareValues } from '../sorting';

describe('la regla de comparación (la misma en todas las tablas)', () => {
  it('los nulos van primero', () => {
    expect(compareValues(null, '2026-01-01')).toBeLessThan(0);
    expect(compareValues('2026-01-01', null)).toBeGreaterThan(0);
    expect(compareValues(null, undefined)).toBe(0);
  });

  it('los números se comparan como números', () => {
    expect(compareValues(10, 9)).toBeGreaterThan(0);
    expect(compareValues(9, 10)).toBeLessThan(0);
    expect(compareValues(10, 10)).toBe(0);
  });

  it('los textos se comparan en español: los acentos no se van al final', () => {
    expect(compareValues('Álvaro', 'Zoe')).toBeLessThan(0);
    expect(compareValues('ana', 'Bruno')).toBeLessThan(0);
    expect(compareValues('Cañón', 'Bruno')).toBeGreaterThan(0);
  });

  it('los dígitos van en su lugar: "Funda 2" antes que "Funda 10"', () => {
    expect(compareValues('Funda 2', 'Funda 10')).toBeLessThan(0);
  });

  it('es estable con valores mezclados', () => {
    expect(compareValues(undefined, undefined)).toBe(0);
    expect(compareValues('a', 'a')).toBe(0);
  });
});
