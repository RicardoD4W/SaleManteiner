import { describe, expect, it } from 'vitest';
import {
  CustomerNameField,
  EuroMoneyField,
  FormDateField,
  LocalDateField,
  ProductNameField,
  QuantityField,
} from '../fields';

describe('los campos del web (misma matriz que el server)', () => {
  it('un texto vacío no es válido', () => {
    expect(ProductNameField.safeParse('').success).toBe(false);
    expect(CustomerNameField.safeParse('').success).toBe(false);
  });

  it('un texto de solo espacios no es válido', () => {
    expect(ProductNameField.safeParse('   ').success).toBe(false);
    expect(CustomerNameField.safeParse('   ').success).toBe(false);
  });

  it('un texto con algo más es válido', () => {
    expect(ProductNameField.safeParse('Funda iPhone 15').success).toBe(true);
    expect(CustomerNameField.safeParse('Ana García').success).toBe(true);
  });

  it('un texto de más de 200 caracteres no es válido', () => {
    expect(ProductNameField.safeParse('a'.repeat(201)).success).toBe(false);
  });

  it('acepta 2 decimales y rechaza 3', () => {
    expect(EuroMoneyField.safeParse(45.5).success).toBe(true);
    expect(EuroMoneyField.safeParse(45.55).success).toBe(true);
    expect(EuroMoneyField.safeParse(45.555).success).toBe(false);
  });

  it('rechaza un importe negativo', () => {
    expect(EuroMoneyField.safeParse(-1).success).toBe(false);
  });

  it('rechaza un importe que no es un número', () => {
    expect(EuroMoneyField.safeParse('45.5').success).toBe(false);
  });

  it('acepta una fecha válida', () => {
    expect(LocalDateField.safeParse('2026-10-23').success).toBe(true);
  });

  it('acepta el 29 de febrero en un año bisiesto', () => {
    expect(LocalDateField.safeParse('2028-02-29').success).toBe(true);
  });

  it('rechaza el 29 de febrero en un año que no es bisiesto', () => {
    expect(LocalDateField.safeParse('2026-02-29').success).toBe(false);
  });

  it('rechaza un mes fuera de rango y un día que no existe', () => {
    expect(LocalDateField.safeParse('2026-13-01').success).toBe(false);
    expect(LocalDateField.safeParse('2026-02-30').success).toBe(false);
  });

  it('rechaza un formato que no es YYYY-MM-DD', () => {
    expect(LocalDateField.safeParse('23/10/2026').success).toBe(false);
  });

  it('el campo del form acepta la fecha vacía (el form la manda como undefined)', () => {
    expect(FormDateField.safeParse('').success).toBe(true);
    expect(FormDateField.safeParse(undefined).success).toBe(true);
    expect(FormDateField.safeParse('2026-10-23').success).toBe(true);
    expect(FormDateField.safeParse('2026-02-30').success).toBe(false);
  });

  it('la cantidad es un entero de 1 o más', () => {
    expect(QuantityField.safeParse(1).success).toBe(true);
    expect(QuantityField.safeParse(0).success).toBe(false);
    expect(QuantityField.safeParse(1.5).success).toBe(false);
  });
});
