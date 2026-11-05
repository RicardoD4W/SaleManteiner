import { beforeEach, describe, expect, it } from 'vitest';
import { readHiddenSeries, writeHiddenSeries } from '../chartPreferences';

describe('chartPreferences', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('devuelve una lista vacía si no hay nada guardado', () => {
    expect(readHiddenSeries('cashflow')).toEqual([]);
  });

  it('guarda y lee las series ocultas de una gráfica', () => {
    writeHiddenSeries('cashflow', ['gastos']);

    expect(readHiddenSeries('cashflow')).toEqual(['gastos']);
    expect(window.localStorage.getItem('salemanteiner-chart-cashflow-hidden')).toBe('["gastos"]');
  });

  it('cada gráfica guarda su propia preferencia', () => {
    writeHiddenSeries('cashflow', ['gastos']);
    writeHiddenSeries('otro', ['beneficio']);

    expect(readHiddenSeries('cashflow')).toEqual(['gastos']);
    expect(readHiddenSeries('otro')).toEqual(['beneficio']);
  });

  it('si el valor guardado está corrupto, no rompe y devuelve una lista vacía', () => {
    window.localStorage.setItem('salemanteiner-chart-cashflow-hidden', 'no-es-json');

    expect(readHiddenSeries('cashflow')).toEqual([]);
  });

  it('si el valor guardado no es una lista, devuelve una lista vacía', () => {
    window.localStorage.setItem('salemanteiner-chart-cashflow-hidden', '{"gastos":true}');

    expect(readHiddenSeries('cashflow')).toEqual([]);
  });
});
