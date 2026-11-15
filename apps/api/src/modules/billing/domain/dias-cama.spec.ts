import { describe, expect, it } from 'vitest';
import {
  calcularDiasCama,
  EstadiaInvalidaError,
  HOSPITAL_TIME_ZONE,
} from './dias-cama.js';

describe('calcularDiasCama', () => {
  it('usa la zona horaria de Buenos Aires', () => {
    expect(HOSPITAL_TIME_ZONE).toBe('America/Argentina/Buenos_Aires');
  });

  it('el mismo día cuenta como 1', () => {
    expect(calcularDiasCama('2026-11-10T13:00:00.000Z', '2026-11-10T20:00:00.000Z')).toBe(1);
  });

  it('el mismo instante cuenta como 1', () => {
    expect(calcularDiasCama('2026-11-10T13:00:00.000Z', '2026-11-10T13:00:00.000Z')).toBe(1);
  });

  it('ingreso lunes 10:00 y alta jueves 09:00 son 3 días', () => {
    expect(calcularDiasCama('2026-11-09T13:00:00.000Z', '2026-11-12T12:00:00.000Z')).toBe(3);
  });

  it('una estadía corta que cruza la medianoche local cuenta 1 día', () => {
    expect(calcularDiasCama('2026-11-10T02:30:00.000Z', '2026-11-10T04:30:00.000Z')).toBe(1);
  });

  it('un ingreso a las 23:30 locales y alta a las 00:30 locales del día siguiente es 1 día', () => {
    expect(calcularDiasCama('2026-11-11T02:30:00.000Z', '2026-11-11T03:30:00.000Z')).toBe(1);
  });

  it('un ingreso a las 23:30 locales y alta pasado el mediodía del día siguiente es 1 día', () => {
    expect(calcularDiasCama('2026-11-11T02:30:00.000Z', '2026-11-11T16:00:00.000Z')).toBe(1);
  });

  it('el día se calcula en hora local y no en UTC', () => {
    expect(calcularDiasCama('2026-11-10T22:00:00.000Z', '2026-11-11T01:00:00.000Z')).toBe(1);
    expect(calcularDiasCama('2026-11-10T02:59:00.000Z', '2026-11-11T03:01:00.000Z')).toBe(2);
  });

  it('varios días calendario', () => {
    expect(calcularDiasCama('2026-11-01T15:00:00.000Z', '2026-11-15T15:00:00.000Z')).toBe(14);
  });

  it('cruza fin de mes y de año', () => {
    expect(calcularDiasCama('2026-12-30T15:00:00.000Z', '2027-01-02T15:00:00.000Z')).toBe(3);
  });

  it('rechaza un egreso anterior al ingreso', () => {
    expect(() =>
      calcularDiasCama('2026-11-10T13:00:00.000Z', '2026-11-10T12:59:59.000Z'),
    ).toThrow(EstadiaInvalidaError);
  });

  it('rechaza fechas inválidas', () => {
    expect(() => calcularDiasCama('no-es-fecha', '2026-11-10T12:00:00.000Z')).toThrow(
      EstadiaInvalidaError,
    );
    expect(() => calcularDiasCama('2026-11-10T12:00:00.000Z', '')).toThrow(EstadiaInvalidaError);
  });
});
