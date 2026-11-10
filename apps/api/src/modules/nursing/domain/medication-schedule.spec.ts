import {
  dosisEnRango,
  dosisYaAdministrada,
  estaActiva,
  evaluarAdministracion,
  horaDosis,
  indiceDeAdministracion,
  indiceDosisMasCercana,
  inicioDelDia,
  textoFrecuencia,
  type IndicacionPlan,
} from './medication-schedule.js';

const inicio = new Date('2030-01-01T06:00:00.000Z');
const plan8h: IndicacionPlan = { fechaInicio: inicio, fechaFin: null, frecuenciaHoras: 8 };
// Dosis: 06:00, 14:00, 22:00, 06:00 (+1d)...
const en = (iso: string) => new Date(iso);

describe('medication-schedule', () => {
  describe('textoFrecuencia', () => {
    it('formats singular and plural', () => {
      expect(textoFrecuencia(8)).toBe('cada 8 horas');
      expect(textoFrecuencia(1)).toBe('cada 1 hora');
    });
  });

  describe('horaDosis', () => {
    it('computes inicio + k * frecuencia', () => {
      expect(horaDosis(plan8h, 0).toISOString()).toBe('2030-01-01T06:00:00.000Z');
      expect(horaDosis(plan8h, 1).toISOString()).toBe('2030-01-01T14:00:00.000Z');
      expect(horaDosis(plan8h, 3).toISOString()).toBe('2030-01-02T06:00:00.000Z');
    });
  });

  describe('estaActiva', () => {
    it('is inactive before start and active right at start', () => {
      expect(estaActiva(plan8h, en('2030-01-01T05:59:59.999Z'))).toBe(false);
      expect(estaActiva(plan8h, inicio)).toBe(true);
    });
    it('is always active after start when there is no end date', () => {
      expect(estaActiva(plan8h, en('2040-01-01T00:00:00.000Z'))).toBe(true);
    });
    it('expires exactly at fechaFin', () => {
      const plan = { ...plan8h, fechaFin: en('2030-01-03T00:00:00.000Z') };
      expect(estaActiva(plan, en('2030-01-02T23:59:59.999Z'))).toBe(true);
      expect(estaActiva(plan, en('2030-01-03T00:00:00.000Z'))).toBe(false);
    });
  });

  describe('indiceDosisMasCercana', () => {
    it('picks the nearest dose', () => {
      expect(indiceDosisMasCercana(plan8h, en('2030-01-01T13:00:00.000Z'))).toBe(1);
      expect(indiceDosisMasCercana(plan8h, en('2030-01-01T09:00:00.000Z'))).toBe(0);
    });
    it('prefers the earlier dose on an exact tie', () => {
      expect(indiceDosisMasCercana(plan8h, en('2030-01-01T10:00:00.000Z'))).toBe(0);
    });
    it('never returns a negative index', () => {
      expect(indiceDosisMasCercana(plan8h, en('2029-12-31T00:00:00.000Z'))).toBe(0);
    });
  });

  describe('evaluarAdministracion', () => {
    it('accepts exactly the scheduled time', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T14:00:00.000Z'))).toMatchObject({ ok: true, indice: 1 });
    });
    it('accepts exactly +30 minutes', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T14:30:00.000Z'))).toMatchObject({ ok: true, indice: 1 });
    });
    it('accepts exactly -30 minutes', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T13:30:00.000Z'))).toMatchObject({ ok: true, indice: 1 });
    });
    it('rejects 31 minutes late', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T14:31:00.000Z'))).toEqual({
        ok: false,
        motivo: 'FUERA_DE_VENTANA',
      });
    });
    it('rejects 31 minutes early', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T13:29:00.000Z'))).toEqual({
        ok: false,
        motivo: 'FUERA_DE_VENTANA',
      });
    });
    it('rejects 30 minutes and 1 millisecond late', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T14:30:00.001Z')).ok).toBe(false);
    });
    it('accepts the first dose at the start instant', () => {
      expect(evaluarAdministracion(plan8h, inicio)).toMatchObject({ ok: true, indice: 0 });
    });
    it('rejects before fechaInicio even inside the first window', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-01T05:45:00.000Z'))).toEqual({
        ok: false,
        motivo: 'NO_INICIADA',
      });
    });
    it('rejects an expired indication', () => {
      const plan = { ...plan8h, fechaFin: en('2030-01-01T14:00:00.000Z') };
      expect(evaluarAdministracion(plan, en('2030-01-01T14:00:00.000Z'))).toEqual({ ok: false, motivo: 'VENCIDA' });
      expect(evaluarAdministracion(plan, en('2030-01-02T14:00:00.000Z'))).toEqual({ ok: false, motivo: 'VENCIDA' });
    });
    it('rejects when the nearest dose would fall on or after fechaFin', () => {
      const plan = { ...plan8h, fechaFin: en('2030-01-01T13:50:00.000Z') };
      expect(evaluarAdministracion(plan, en('2030-01-01T13:45:00.000Z'))).toEqual({
        ok: false,
        motivo: 'FUERA_DE_VENTANA',
      });
    });
    it('accepts the last dose before fechaFin', () => {
      const plan = { ...plan8h, fechaFin: en('2030-01-01T14:10:00.000Z') };
      expect(evaluarAdministracion(plan, en('2030-01-01T14:05:00.000Z'))).toMatchObject({ ok: true, indice: 1 });
    });
    it('does not guess when frecuenciaHoras is null', () => {
      const plan = { ...plan8h, frecuenciaHoras: null };
      expect(evaluarAdministracion(plan, inicio)).toEqual({ ok: false, motivo: 'SIN_FRECUENCIA' });
    });
    it('works days after the start', () => {
      expect(evaluarAdministracion(plan8h, en('2030-01-10T21:50:00.000Z'))).toMatchObject({ ok: true, indice: 29 });
    });
    it('handles hourly frequency windows touching at 30 minutes', () => {
      const plan = { ...plan8h, frecuenciaHoras: 1 };
      expect(evaluarAdministracion(plan, en('2030-01-01T10:30:00.000Z'))).toMatchObject({ ok: true, indice: 4 });
      expect(evaluarAdministracion(plan, en('2030-01-01T10:31:00.000Z'))).toMatchObject({ ok: true, indice: 5 });
    });
  });

  describe('dosisYaAdministrada / indiceDeAdministracion', () => {
    it('maps an administration to its dose', () => {
      expect(indiceDeAdministracion(plan8h, en('2030-01-01T14:12:00.000Z'))).toBe(1);
    });
    it('returns null for an administration outside any window', () => {
      expect(indiceDeAdministracion(plan8h, en('2030-01-01T10:00:00.000Z'))).toBeNull();
      expect(indiceDeAdministracion({ ...plan8h, frecuenciaHoras: null }, inicio)).toBeNull();
    });
    it('detects a double administration of the same dose', () => {
      expect(dosisYaAdministrada(plan8h, 1, [en('2030-01-01T13:45:00.000Z')])).toBe(true);
    });
    it('does not confuse different doses', () => {
      expect(dosisYaAdministrada(plan8h, 1, [en('2030-01-01T06:05:00.000Z')])).toBe(false);
      expect(dosisYaAdministrada(plan8h, 1, [])).toBe(false);
    });
  });

  describe('inicioDelDia', () => {
    it('uses the hospital calendar day (UTC-3)', () => {
      expect(inicioDelDia(en('2030-01-01T14:00:00.000Z')).toISOString()).toBe('2030-01-01T03:00:00.000Z');
      expect(inicioDelDia(en('2030-01-01T02:59:59.000Z')).toISOString()).toBe('2029-12-31T03:00:00.000Z');
      expect(inicioDelDia(en('2030-01-01T03:00:00.000Z')).toISOString()).toBe('2030-01-01T03:00:00.000Z');
    });
  });

  describe('dosisEnRango', () => {
    const desde = en('2030-01-01T03:00:00.000Z');
    const hasta = en('2030-01-02T03:00:00.000Z');
    it('lists the doses of the day', () => {
      const dosis = dosisEnRango(plan8h, desde, hasta);
      expect(dosis.map((d) => d.programadaPara.toISOString())).toEqual([
        '2030-01-01T06:00:00.000Z',
        '2030-01-01T14:00:00.000Z',
        '2030-01-01T22:00:00.000Z',
      ]);
      expect(dosis.map((d) => d.indice)).toEqual([0, 1, 2]);
    });
    it('skips doses before the start', () => {
      const plan = { ...plan8h, fechaInicio: en('2030-01-01T10:00:00.000Z') };
      expect(dosisEnRango(plan, desde, hasta).map((d) => d.indice)).toEqual([0, 1, 2]);
    });
    it('stops at fechaFin', () => {
      const plan = { ...plan8h, fechaFin: en('2030-01-01T14:00:00.000Z') };
      expect(dosisEnRango(plan, desde, hasta).map((d) => d.indice)).toEqual([0]);
    });
    it('keeps correct indexes on later days', () => {
      const dosis = dosisEnRango(plan8h, en('2030-01-03T03:00:00.000Z'), en('2030-01-04T03:00:00.000Z'));
      expect(dosis.map((d) => d.indice)).toEqual([6, 7, 8]);
    });
    it('returns nothing without frequency or when the range ends before the start', () => {
      expect(dosisEnRango({ ...plan8h, frecuenciaHoras: null }, desde, hasta)).toEqual([]);
      expect(dosisEnRango(plan8h, en('2029-12-01T00:00:00.000Z'), en('2029-12-02T00:00:00.000Z'))).toEqual([]);
    });
  });
});
