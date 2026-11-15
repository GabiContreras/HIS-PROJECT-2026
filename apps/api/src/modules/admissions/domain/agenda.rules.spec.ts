import { entraEnAgenda, validarBloques } from './agenda.rules.js';

const LUNES = '2026-11-16';

const base = {
  bloques: [{ diaSemana: 1, horaInicio: '09:00', horaFin: '13:00' }],
  horaInicioDefault: '08:00',
  horaFinDefault: '20:00',
  fecha: LUNES,
  duracion: 30,
  fechasBloqueadas: new Set<string>(),
};

describe('agenda médica', () => {
  it('acepta un horario dentro del bloque del día', () => {
    expect(entraEnAgenda({ ...base, minutoInicio: 9 * 60 })).toBe(true);
    expect(entraEnAgenda({ ...base, minutoInicio: 12 * 60 + 30 })).toBe(true);
  });

  it('rechaza un horario que se pasa del bloque', () => {
    expect(entraEnAgenda({ ...base, minutoInicio: 13 * 60 })).toBe(false);
    expect(entraEnAgenda({ ...base, minutoInicio: 8 * 60 })).toBe(false);
  });

  it('rechaza un día sin bloque', () => {
    expect(entraEnAgenda({ ...base, fecha: '2026-11-17', minutoInicio: 9 * 60 })).toBe(false);
  });

  it('sin bloques usa el horario por defecto todos los días', () => {
    expect(
      entraEnAgenda({ ...base, bloques: [], fecha: '2026-11-17', minutoInicio: 8 * 60 }),
    ).toBe(true);
    expect(
      entraEnAgenda({ ...base, bloques: [], minutoInicio: 19 * 60 + 30 }),
    ).toBe(true);
    expect(entraEnAgenda({ ...base, bloques: [], minutoInicio: 20 * 60 })).toBe(false);
  });

  it('una fecha bloqueada anula la agenda', () => {
    expect(
      entraEnAgenda({
        ...base,
        minutoInicio: 9 * 60,
        fechasBloqueadas: new Set([LUNES]),
      }),
    ).toBe(false);
  });

  it('valida bloques fuera de la clínica, invertidos y superpuestos', () => {
    expect(
      validarBloques([{ diaSemana: 1, horaInicio: '07:00', horaFin: '10:00' }]),
    ).toContain('08:00 a 20:00');
    expect(
      validarBloques([{ diaSemana: 1, horaInicio: '12:00', horaFin: '10:00' }]),
    ).toContain('anterior');
    expect(
      validarBloques([
        { diaSemana: 1, horaInicio: '08:00', horaFin: '12:00' },
        { diaSemana: 1, horaInicio: '11:30', horaFin: '14:00' },
      ]),
    ).toContain('superponerse');
    expect(
      validarBloques([
        { diaSemana: 1, horaInicio: '08:00', horaFin: '12:00' },
        { diaSemana: 1, horaInicio: '14:00', horaFin: '18:00' },
        { diaSemana: 2, horaInicio: '08:00', horaFin: '12:00' },
      ]),
    ).toBeNull();
  });
});