import { armarPeriodo, armarRango, PeriodoInvalidoError } from './periodo-reporte.js';

describe('armarRango', () => {
  it('con desde y hasta coincide con armarPeriodo', () => {
    const periodo = armarPeriodo('2026-03-10', '2026-03-12');

    expect(armarRango('2026-03-10', '2026-03-12')).toEqual({
      inicio: periodo.inicio,
      finExclusivo: periodo.finExclusivo,
    });
  });

  it('sin desde ni hasta no tiene limites', () => {
    expect(armarRango()).toEqual({ inicio: null, finExclusivo: null });
  });

  it('solo desde deja abierto el tope superior', () => {
    const rango = armarRango('2026-03-10', undefined);

    expect(rango.inicio?.toISOString()).toBe('2026-03-10T03:00:00.000Z');
    expect(rango.finExclusivo).toBeNull();
  });

  it('solo hasta deja abierto el tope inferior e incluye todo el dia', () => {
    const rango = armarRango(undefined, '2026-03-10');

    expect(rango.inicio).toBeNull();
    expect(rango.finExclusivo?.toISOString()).toBe('2026-03-11T03:00:00.000Z');
  });

  it('acepta el fin de mes y de anio en hasta', () => {
    expect(armarRango(undefined, '2026-12-31').finExclusivo?.toISOString()).toBe(
      '2027-01-01T03:00:00.000Z',
    );
    expect(armarRango(undefined, '2028-02-29').finExclusivo?.toISOString()).toBe(
      '2028-03-01T03:00:00.000Z',
    );
  });

  it.each([
    ['formato invalido en desde', '10/03/2026', undefined],
    ['formato invalido en hasta', undefined, '2026-3-1'],
    ['desde vacio', '', undefined],
    ['hasta vacio', undefined, ''],
    ['fecha imposible en desde', '2026-02-30', undefined],
    ['fecha imposible en hasta', undefined, '2026-13-01'],
    ['desde posterior a hasta', '2026-03-12', '2026-03-10'],
  ])('rechaza %s', (_caso, desde, hasta) => {
    expect(() => armarRango(desde, hasta)).toThrow(PeriodoInvalidoError);
  });

  it('nombra el parametro con error', () => {
    expect(() => armarRango(undefined, 'ayer')).toThrow(/"hasta"/);
    expect(() => armarRango('ayer', undefined)).toThrow(/"desde"/);
  });
});
