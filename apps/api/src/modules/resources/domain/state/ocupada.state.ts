import { EstadoCama } from '../estado-cama.enum.js';
import { BedState } from './bed-state.js';
 
export class OcupadaState extends BedState {
  readonly estado = EstadoCama.OCUPADA;
 
  override darAlta(): EstadoCama {
    return EstadoCama.EN_LIMPIEZA;
  }
}
 