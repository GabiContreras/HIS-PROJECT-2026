import { armarPeriodo, PeriodoInvalidoError } from './periodo-reporte.js';

describe('armarPeriodo', () => {
  it('toma el inicio del día desde y el fin del día hasta en hora de Buenos Aires', () => {
    const periodo = armarPeriodo('2026-03-10', '2026-03-12');

    expect(periodo.inicio.toISOString()).toBe('2026-03-10T03:00:00.000Z');
    expect(periodo.finExclusivo.toISOString()).toBe('2026-03-13T03:00:00.000Z');
    expect(periodo.desde).toBe('2026-03-10');
    expect(periodo.hasta).toBe('2026-03-12');
  });

  it('con desde igual a hasta cubre exactamente 24 horas', () => {
    const periodo = armarPeriodo('2026-06-15', '2026-06-15');

    expect(periodo.finExclusivo.getTime() - periodo.inicio.getTime()).toBe(24 * 60 * 60 * 1000);
  });

  it('un instante a las 23:30 locales cae dentro de su día local aunque en UTC sea el día siguiente', () => {
    const periodo = armarPeriodo('2026-03-10', '2026-03-10');
    const instante = new Date('2026-03-11T02:30:00.000Z').getTime();

    expect(instante).toBeGreaterThanOrEqual(periodo.inicio.getTime());
    expect(instante).toBeLessThan(periodo.finExclusivo.getTime());
  });

  it('el primer instante del día siguiente local queda fuera del período', () => {
    const periodo = armarPeriodo('2026-03-10', '2026-03-10');

    expect(periodo.finExclusivo.toISOString()).toBe('2026-03-11T03:00:00.000Z');
  });

  it('febrero de un año bisiesto incluye el 29', () => {
    const periodo = armarPeriodo('2028-02-01', '2028-02-29');

    expect(periodo.finExclusivo.toISOString()).toBe('2028-03-01T03:00:00.000Z');
  });

  it('el fin de febrero de un año no bisiesto pasa a marzo', () => {
    const periodo = armarPeriodo('2027-02-01', '2027-02-28');

    expect(periodo.finExclusivo.toISOString()).toBe('2027-03-01T03:00:00.000Z');
  });

  it('el fin de diciembre pasa al año siguiente', () => {
    const periodo = armarPeriodo('2026-12-01', '2026-12-31');

    expect(periodo.finExclusivo.toISOString()).toBe('2027-01-01T03:00:00.000Z');
  });

  it.each([
    ['2026-02-30', '2026-03-01'],
    ['2027-02-29', '2027-03-01'],
    ['2026-13-01', '2026-12-01'],
    ['2026-00-10', '2026-12-01'],
    ['2026-04-31', '2026-05-01'],
    ['2026-03-01', '2026-02-30'],
  ])('rechaza fechas imposibles (%s, %s)', (desde, hasta) => {
    expect(() => armarPeriodo(desde, hasta)).toThrow(PeriodoInvalidoError);
  });

  it.each([
    ['10/03/2026', '2026-03-12'],
    ['2026-3-1', '2026-03-12'],
    ['2026-03-10T00:00:00Z', '2026-03-12'],
    ['', '2026-03-12'],
    ['2026-03-10', 'mañana'],
  ])('rechaza formatos inválidos (%s, %s)', (desde, hasta) => {
    expect(() => armarPeriodo(desde, hasta)).toThrow(PeriodoInvalidoError);
  });

  it('rechaza desde posterior a hasta', () => {
    expect(() => armarPeriodo('2026-03-11', '2026-03-10')).toThrow(PeriodoInvalidoError);
  });
});
