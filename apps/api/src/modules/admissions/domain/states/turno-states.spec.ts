import { EstadoTurno } from '../../../../entities/turno.entity.js';
import { TransicionTurnoInvalidaError } from './turno-state.interface.js';
import { tablaTransiciones, turnoStateFor } from './turno-states.js';

describe('Máquina de estados del turno (HU 2.1)', () => {
  it('permite Confirmado → En Sala de Espera', () => {
    expect(
      turnoStateFor(EstadoTurno.CONFIRMADO).transicionarA(
        EstadoTurno.EN_SALA_DE_ESPERA,
      ),
    ).toBe(EstadoTurno.EN_SALA_DE_ESPERA);
  });

  it('bloquea Cancelado → Atendido con el mensaje de negocio de la HU', () => {
    expect(() =>
      turnoStateFor(EstadoTurno.CANCELADO).transicionarA(EstadoTurno.ATENDIDO),
    ).toThrowError(
      new TransicionTurnoInvalidaError(
        'Un turno cancelado no puede avanzar en el flujo de atención.',
      ),
    );
  });

  it('un turno atendido no puede cancelarse', () => {
    expect(() =>
      turnoStateFor(EstadoTurno.ATENDIDO).transicionarA(EstadoTurno.CANCELADO),
    ).toThrow(TransicionTurnoInvalidaError);
  });

  it('no se puede saltar la sala de espera', () => {
    expect(() =>
      turnoStateFor(EstadoTurno.CONFIRMADO).transicionarA(EstadoTurno.ATENDIDO),
    ).toThrow(TransicionTurnoInvalidaError);
  });

  it('expone la tabla de transiciones válidas', () => {
    const tabla = tablaTransiciones();
    expect(tabla[EstadoTurno.RESERVADO]).toEqual([
      EstadoTurno.CONFIRMADO,
      EstadoTurno.CANCELADO,
    ]);
    expect(tabla[EstadoTurno.CONFIRMADO]).toEqual([
      EstadoTurno.EN_SALA_DE_ESPERA,
      EstadoTurno.CANCELADO,
    ]);
    expect(tabla[EstadoTurno.EN_SALA_DE_ESPERA]).toEqual([EstadoTurno.ATENDIDO]);
    expect(tabla[EstadoTurno.ATENDIDO]).toEqual([]);
    expect(tabla[EstadoTurno.CANCELADO]).toEqual([]);
  });
});
