import { describe, it, expect } from 'vitest';
import { EstadoCama } from '../estado-cama.enum.js';
import { InvalidBedTransitionError } from '../invalid-bed-transition.error.js';
import { BedState } from './bed-state.js';
import { BedStateFactory } from './bed-state.factory.js';
 
type Accion = 'ocupar' | 'darAlta' | 'confirmarLimpieza' | 'bloquear' | 'desbloquear';
 
const ACCIONES: Accion[] = [
  'ocupar',
  'darAlta',
  'confirmarLimpieza',
  'bloquear',
  'desbloquear',
];
 
/**
 * Tabla de verdad de la máquina de estados:
 * estado de origen -> { acción válida: estado destino }.
 * Cualquier acción que NO figure acá debe ser rechazada.
 */
const TRANSICIONES_VALIDAS: Record<EstadoCama, Partial<Record<Accion, EstadoCama>>> = {
  [EstadoCama.LIBRE]: {
    ocupar: EstadoCama.OCUPADA,
    bloquear: EstadoCama.BLOQUEADA,
  },
  [EstadoCama.OCUPADA]: {
    darAlta: EstadoCama.EN_LIMPIEZA,
  },
  [EstadoCama.EN_LIMPIEZA]: {
    confirmarLimpieza: EstadoCama.LIBRE,
  },
  [EstadoCama.BLOQUEADA]: {
    desbloquear: EstadoCama.LIBRE,
  },
};
 
function ejecutar(estado: BedState, accion: Accion): EstadoCama {
  return estado[accion]();
}
 
function capturar(fn: () => unknown): unknown {
  try {
    fn();
  } catch (error) {
    return error;
  }
  return undefined;
}
 
describe('Máquina de estados de la cama (patrón State)', () => {
  for (const origen of Object.values(EstadoCama)) {
    describe(`desde ${origen}`, () => {
      const estado = BedStateFactory.from(origen);
 
      for (const accion of ACCIONES) {
        const destino = TRANSICIONES_VALIDAS[origen][accion];
 
        if (destino) {
          it(`${accion}() es válida y devuelve ${destino}`, () => {
            expect(ejecutar(estado, accion)).toBe(destino);
          });
        } else {
          it(`${accion}() es inválida y lanza InvalidBedTransitionError`, () => {
            const error = capturar(() => ejecutar(estado, accion));
            expect(error).toBeInstanceOf(InvalidBedTransitionError);
            expect((error as InvalidBedTransitionError).desde).toBe(origen);
          });
        }
      }
    });
  }
 
  it('el ciclo completo vuelve a LIBRE: LIBRE -> OCUPADA -> EN_LIMPIEZA -> LIBRE', () => {
    let actual = EstadoCama.LIBRE;
    actual = BedStateFactory.from(actual).ocupar();
    expect(actual).toBe(EstadoCama.OCUPADA);
    actual = BedStateFactory.from(actual).darAlta();
    expect(actual).toBe(EstadoCama.EN_LIMPIEZA);
    actual = BedStateFactory.from(actual).confirmarLimpieza();
    expect(actual).toBe(EstadoCama.LIBRE);
  });
 
  it('una cama BLOQUEADA vuelve a LIBRE solo desbloqueándola', () => {
    const bloqueada = BedStateFactory.from(
      BedStateFactory.from(EstadoCama.LIBRE).bloquear(),
    );
    expect(bloqueada.estado).toBe(EstadoCama.BLOQUEADA);
    expect(bloqueada.desbloquear()).toBe(EstadoCama.LIBRE);
  });
 
  it('el mensaje de error nombra la acción y el estado actual', () => {
    const error = capturar(() => BedStateFactory.from(EstadoCama.OCUPADA).ocupar());
    expect((error as Error).message).toBe(
      'No se puede asignar un paciente a una cama en estado OCUPADA.',
    );
 
    const otro = capturar(() => BedStateFactory.from(EstadoCama.LIBRE).darAlta());
    expect((otro as Error).message).toBe(
      'No se puede dar el alta médica en una cama en estado LIBRE.',
    );
  });
});