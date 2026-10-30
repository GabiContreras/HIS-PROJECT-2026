import { EstadoCama } from '../estado-cama.enum.js';
import { BedState } from './bed-state.js';
import { BloqueadaState } from './bloqueada.state.js';
import { EnLimpiezaState } from './en-limpieza.state.js';
import { LibreState } from './libre.state.js';
import { OcupadaState } from './ocupada.state.js';
 
// Los estados no guardan datos propios, así que alcanza una instancia compartida por estado.
const STATES: Record<EstadoCama, BedState> = {
  [EstadoCama.LIBRE]: new LibreState(),
  [EstadoCama.OCUPADA]: new OcupadaState(),
  [EstadoCama.EN_LIMPIEZA]: new EnLimpiezaState(),
  [EstadoCama.BLOQUEADA]: new BloqueadaState(),
};
 
export class BedStateFactory {
  /** Dado el valor guardado en BD, devuelve el objeto-estado que sabe qué transiciones admite. */
  static from(estado: EstadoCama): BedState {
    return STATES[estado];
  }
}
 