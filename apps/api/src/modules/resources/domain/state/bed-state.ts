import { EstadoCama } from '../estado-cama.enum.js';
import { InvalidBedTransitionError } from '../invalid-bed-transition.error.js';
 
export abstract class BedState {
  abstract readonly estado: EstadoCama;
 
  ocupar(): EstadoCama {
    throw this.invalida('asignar un paciente a');
  }
 
  darAlta(): EstadoCama {
    throw this.invalida('dar el alta médica en');
  }
 
  confirmarLimpieza(): EstadoCama {
    throw this.invalida('confirmar la limpieza de');
  }
 
  bloquear(): EstadoCama {
    throw this.invalida('bloquear');
  }
 
  desbloquear(): EstadoCama {
    throw this.invalida('desbloquear');
  }
 
  protected invalida(accion: string): InvalidBedTransitionError {
    return new InvalidBedTransitionError(this.estado, accion);
  }
}
 