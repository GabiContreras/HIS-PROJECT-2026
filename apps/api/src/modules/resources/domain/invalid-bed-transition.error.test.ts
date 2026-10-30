import { describe, it, expect } from 'vitest';
import { EstadoCama } from './estado-cama.enum.js';
import { InvalidBedTransitionError } from './invalid-bed-transition.error.js';
 
describe('InvalidBedTransitionError', () => {
  const error = new InvalidBedTransitionError(EstadoCama.OCUPADA, 'bloquear');
 
  it('es un Error con nombre propio', () => {
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(InvalidBedTransitionError);
    expect(error.name).toBe('InvalidBedTransitionError');
  });
 
  it('conserva el estado de origen y la acción intentada', () => {
    expect(error.desde).toBe(EstadoCama.OCUPADA);
    expect(error.accion).toBe('bloquear');
  });
 
  it('arma un mensaje legible para mostrar al operador', () => {
    expect(error.message).toBe(
      'No se puede bloquear una cama en estado OCUPADA.',
    );
  });
});