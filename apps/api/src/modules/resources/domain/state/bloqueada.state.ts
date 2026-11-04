import { EstadoCama } from '../estado-cama.enum.js';
import { BedState } from './bed-state.js';
 
export class BloqueadaState extends BedState {
  readonly estado = EstadoCama.BLOQUEADA;
 
  override desbloquear(): EstadoCama {
    return EstadoCama.LIBRE;
  }
}