import { describe, expect, it } from 'vitest';
import {
  describeRange,
  findActivePreset,
  formatIsoDate,
  isIsoDate,
  isRangeActive,
  isValidRange,
  presetRange,
  rangesEqual,
  toIsoDate,
} from '../dateRange';

describe('dateRange', () => {
  describe('toIsoDate', () => {
    it('usa la fecha local, sin moverse de día por zona horaria', () => {
      expect(toIsoDate(new Date(2026, 0, 1))).toBe('2026-01-01');
      expect(toIsoDate(new Date(2026, 11, 31))).toBe('2026-12-31');
      expect(toIsoDate(new Date(2026, 2, 9))).toBe('2026-03-09');
    });
  });

  describe('isIsoDate', () => {
    it('acepta solo el formato YYYY-MM-DD', () => {
      expect(isIsoDate('2026-04-10')).toBe(true);
      expect(isIsoDate('10/04/2026')).toBe(false);
      expect(isIsoDate('2026-4-10')).toBe(false);
      expect(isIsoDate(undefined)).toBe(false);
      expect(isIsoDate(null)).toBe(false);
    });
  });

  describe('formatIsoDate', () => {
    it('lo pasa a dd/MM/yyyy sin tocar la zona horaria', () => {
      expect(formatIsoDate('2026-04-10')).toBe('10/04/2026');
      expect(formatIsoDate('2026-01-01')).toBe('01/01/2026');
    });

    it('devuelve el texto tal cual si no es una fecha válida', () => {
      expect(formatIsoDate('no es una fecha')).toBe('no es una fecha');
    });
  });

  describe('presetRange', () => {
    it('"Este mes" va del primer día al último del mes actual', () => {
      expect(presetRange('month', new Date(2026, 10, 5))).toEqual({
        from: '2026-11-01',
        to: '2026-11-30',
      });
    });

    it('"Este mes" en febrero sin salto da el 28', () => {
      expect(presetRange('month', new Date(2026, 1, 10))).toEqual({
        from: '2026-02-01',
        to: '2026-02-28',
      });
    });

    it('"Último trimestre" son los tres meses que incluyen el actual', () => {
      expect(presetRange('quarter', new Date(2026, 10, 5))).toEqual({
        from: '2026-09-01',
        to: '2026-11-30',
      });
    });

    it('"Último trimestre" en enero cruza el año', () => {
      expect(presetRange('quarter', new Date(2026, 0, 15))).toEqual({
        from: '2025-11-01',
        to: '2026-01-31',
      });
    });

    it('"Este año" va de enero a diciembre', () => {
      expect(presetRange('year', new Date(2026, 5, 5))).toEqual({
        from: '2026-01-01',
        to: '2026-12-31',
      });
    });

    it('"Todo" no filtra', () => {
      expect(presetRange('all', new Date(2026, 5, 5))).toEqual({});
    });
  });

  describe('isRangeActive', () => {
    it('solo cuenta con alguna fecha puesta', () => {
      expect(isRangeActive({})).toBe(false);
      expect(isRangeActive({ from: '2026-01-01' })).toBe(true);
      expect(isRangeActive({ to: '2026-01-01' })).toBe(true);
    });
  });

  describe('isValidRange', () => {
    it('un rango con las fechas invertidas no vale', () => {
      expect(isValidRange({ from: '2026-05-10', to: '2026-05-01' })).toBe(false);
    });

    it('el mismo día en los dos extremos vale', () => {
      expect(isValidRange({ from: '2026-05-10', to: '2026-05-10' })).toBe(true);
    });

    it('con un solo extremo vale', () => {
      expect(isValidRange({ from: '2026-05-10' })).toBe(true);
      expect(isValidRange({ to: '2026-05-10' })).toBe(true);
      expect(isValidRange({})).toBe(true);
    });
  });

  describe('rangesEqual', () => {
    it('compara los dos extremos tratando los que faltan como vacíos', () => {
      expect(rangesEqual({ from: '2026-01-01' }, { from: '2026-01-01' })).toBe(true);
      expect(rangesEqual({ from: '2026-01-01' }, { from: '2026-01-01', to: '' })).toBe(true);
      expect(rangesEqual({ from: '2026-01-01' }, { from: '2026-01-02' })).toBe(false);
      expect(rangesEqual({}, { from: '2026-01-01' })).toBe(false);
    });
  });

  describe('findActivePreset', () => {
    it('reconoce el preset que coincide con el rango', () => {
      const range = presetRange('month', new Date(2026, 10, 5));
      expect(findActivePreset(range, new Date(2026, 10, 5))).toBe('month');
    });

    it('un rango a medida es "custom"', () => {
      expect(findActivePreset({ from: '2026-01-03', to: '2026-01-09' })).toBe('custom');
    });

    it('sin filtro es "all"', () => {
      expect(findActivePreset({})).toBe('all');
    });
  });

  describe('describeRange', () => {
    it('describe el rango con las dos fechas', () => {
      expect(describeRange({ from: '2026-01-01', to: '2026-01-31' })).toBe(
        'Del 01/01/2026 al 31/01/2026',
      );
    });

    it('describe un rango con un solo extremo', () => {
      expect(describeRange({ from: '2026-01-01' })).toBe('Desde 01/01/2026');
      expect(describeRange({ to: '2026-01-31' })).toBe('Hasta 31/01/2026');
    });

    it('dice que no hay filtro', () => {
      expect(describeRange({})).toBe('Sin filtro de fecha');
    });
  });
});
