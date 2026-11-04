import { EstadoTurno } from '../../../../entities/turno.entity.js';

/** Error de regla de negocio: la transición pedida no es válida para el estado actual. */
export class TransicionTurnoInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransicionTurnoInvalidaError';
  }
}

/**
 * Patrón State del turno (HU 2.1). Cada método devuelve el estado destino
 * o lanza TransicionTurnoInvalidaError si la transición no está permitida.
 */
export interface ITurnoState {
  readonly estado: EstadoTurno;
  confirmar(): EstadoTurno;
  ponerEnSalaEspera(): EstadoTurno;
  atender(): EstadoTurno;
  cancelar(): EstadoTurno;
  /** Destinos válidos desde este estado (derivados de los métodos de arriba). */
  transicionesPermitidas(): EstadoTurno[];
  transicionarA(destino: EstadoTurno): EstadoTurno;
}
