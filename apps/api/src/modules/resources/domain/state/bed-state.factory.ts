import { EstadoCama } from '../estado-cama.enum.js';
import { BedState } from './bed-state.js';
import { BloqueadaState } from './bloqueada.state.js';
import { EnLimpiezaState } from './en-limpieza.state.js';
import { LibreState } from './libre.state.js';
import { OcupadaState } from './ocupada.state.js';
 
const STATES: Record<EstadoCama, BedState> = {
  [EstadoCama.LIBRE]: new LibreState(),
  [EstadoCama.OCUPADA]: new OcupadaState(),
  [EstadoCama.EN_LIMPIEZA]: new EnLimpiezaState(),
  [EstadoCama.BLOQUEADA]: new BloqueadaState(),
};
 
export class BedStateFactory {
  static from(estado: EstadoCama): BedState {
    return STATES[estado];
  }
}
 