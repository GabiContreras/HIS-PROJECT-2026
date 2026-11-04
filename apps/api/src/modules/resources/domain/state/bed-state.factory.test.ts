import { describe, it, expect } from 'vitest';
import { EstadoCama } from '../estado-cama.enum.js';
import { BedStateFactory } from './bed-state.factory.js';
import { BloqueadaState } from './bloqueada.state.js';
import { EnLimpiezaState } from './en-limpieza.state.js';
import { LibreState } from './libre.state.js';
import { OcupadaState } from './ocupada.state.js';
 
describe('BedStateFactory', () => {
  it('devuelve la clase de estado que corresponde a cada EstadoCama', () => {
    expect(BedStateFactory.from(EstadoCama.LIBRE)).toBeInstanceOf(LibreState);
    expect(BedStateFactory.from(EstadoCama.OCUPADA)).toBeInstanceOf(OcupadaState);
    expect(BedStateFactory.from(EstadoCama.EN_LIMPIEZA)).toBeInstanceOf(EnLimpiezaState);
    expect(BedStateFactory.from(EstadoCama.BLOQUEADA)).toBeInstanceOf(BloqueadaState);
  });
 
  it('cada objeto-estado reporta el EstadoCama con el que se pidió', () => {
    for (const estado of Object.values(EstadoCama)) {
      expect(BedStateFactory.from(estado).estado).toBe(estado);
    }
  });
 
  it('reutiliza la misma instancia por estado', () => {
    expect(BedStateFactory.from(EstadoCama.LIBRE)).toBe(
      BedStateFactory.from(EstadoCama.LIBRE),
    );
  });
});