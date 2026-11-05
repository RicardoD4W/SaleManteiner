import { describe, expect, it } from 'vitest';
import {
  METRIC_CHART_COLOR,
  METRIC_COLOR,
  METRIC_DOT_COLOR,
  profitColorClass,
  variationColorClass,
} from '../colors';

describe('paleta de métricas', () => {
  it('cada métrica tiene un único color para el KPI, el punto y la línea', () => {
    expect(METRIC_COLOR.gastos).toBe('text-metric-gastos');
    expect(METRIC_DOT_COLOR.gastos).toBe('bg-metric-gastos');
    expect(METRIC_CHART_COLOR.gastos).toBe('var(--color-metric-gastos)');
  });

  it('las métricas con color propio no comparten color entre sí', () => {
    const classes = Object.values(METRIC_COLOR);
    expect(new Set(classes).size).toBe(classes.length);
  });

  it('el beneficio se pinta en verde si es positivo y en rojo si es negativo', () => {
    expect(profitColorClass(10)).toBe(METRIC_COLOR.beneficio);
    expect(profitColorClass(-10)).toBe(METRIC_COLOR.perdida);
    expect(profitColorClass(0)).not.toBe(METRIC_COLOR.beneficio);
    expect(profitColorClass(0)).not.toBe(METRIC_COLOR.perdida);
  });

  it('la variación de gastos se invierte: subir gastos es malo', () => {
    expect(variationColorClass(10, true)).toBe(METRIC_COLOR.perdida);
    expect(variationColorClass(-10, true)).toBe(METRIC_COLOR.beneficio);
  });
});
