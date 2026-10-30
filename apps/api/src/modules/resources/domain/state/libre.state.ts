import { EstadoCama } from '../estado-cama.enum.js';
import { BedState } from './bed-state.js';
 
export class LibreState extends BedState {
  readonly estado = EstadoCama.LIBRE;
 
  override ocupar(): EstadoCama {
    return EstadoCama.OCUPADA;
  }
 
  override bloquear(): EstadoCama {
    return EstadoCama.BLOQUEADA;
  }
}
 