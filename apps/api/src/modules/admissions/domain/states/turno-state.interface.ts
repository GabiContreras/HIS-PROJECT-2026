import { EstadoTurno } from './estado-turno.js';

export class TransicionTurnoInvalidaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TransicionTurnoInvalidaError';
  }
}

export interface ITurnoState {
  readonly estado: EstadoTurno;
  confirmar(): EstadoTurno;
  ponerEnSalaEspera(): EstadoTurno;
  atender(): EstadoTurno;
  cancelar(): EstadoTurno;
  transicionesPermitidas(): EstadoTurno[];
  transicionarA(destino: EstadoTurno): EstadoTurno;
}
