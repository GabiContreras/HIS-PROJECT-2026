import { EstadoCama } from '../estado-cama.enum.js';
import { BedState } from './bed-state.js';
 
export class EnLimpiezaState extends BedState {
  readonly estado = EstadoCama.EN_LIMPIEZA;
 
  override confirmarLimpieza(): EstadoCama {
    return EstadoCama.LIBRE;
  }
}
 