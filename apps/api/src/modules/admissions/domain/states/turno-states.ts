import { EstadoTurno } from '../../../../entities/turno.entity.js';
import {
  ITurnoState,
  TransicionTurnoInvalidaError,
} from './turno-state.interface.js';

const invalida = (mensaje: string): never => {
  throw new TransicionTurnoInvalidaError(mensaje);
};

abstract class TurnoState implements ITurnoState {
  abstract readonly estado: EstadoTurno;

  /** Mensaje por defecto para toda transición no habilitada explícitamente. */
  protected get bloqueo(): string {
    return `No se permite modificar un turno en estado ${this.estado}.`;
  }

  confirmar(): EstadoTurno {
    return invalida(this.bloqueo);
  }
  ponerEnSalaEspera(): EstadoTurno {
    return invalida(this.bloqueo);
  }
  atender(): EstadoTurno {
    return invalida(this.bloqueo);
  }
  cancelar(): EstadoTurno {
    return invalida(this.bloqueo);
  }

  transicionarA(destino: EstadoTurno): EstadoTurno {
    switch (destino) {
      case EstadoTurno.CONFIRMADO:
        return this.confirmar();
      case EstadoTurno.EN_SALA_DE_ESPERA:
        return this.ponerEnSalaEspera();
      case EstadoTurno.ATENDIDO:
        return this.atender();
      case EstadoTurno.CANCELADO:
        return this.cancelar();
      default:
        return invalida('El turno no puede volver a ese estado.');
    }
  }

  transicionesPermitidas(): EstadoTurno[] {
    return [
      EstadoTurno.CONFIRMADO,
      EstadoTurno.EN_SALA_DE_ESPERA,
      EstadoTurno.ATENDIDO,
      EstadoTurno.CANCELADO,
    ].filter((destino) => {
      try {
        this.transicionarA(destino);
        return true;
      } catch {
        return false;
      }
    });
  }
}

/** Reservado = "Programado" en las HU. */
export class TurnoReservadoState extends TurnoState {
  readonly estado = EstadoTurno.RESERVADO;
  override confirmar() {
    return EstadoTurno.CONFIRMADO;
  }
  override cancelar() {
    return EstadoTurno.CANCELADO;
  }
  override ponerEnSalaEspera(): EstadoTurno {
    return invalida(
      'El turno debe confirmarse antes de registrar la llegada del paciente.',
    );
  }
  override atender(): EstadoTurno {
    return invalida(
      'El turno debe confirmarse y pasar por sala de espera antes de ser atendido.',
    );
  }
}

export class TurnoConfirmadoState extends TurnoState {
  readonly estado = EstadoTurno.CONFIRMADO;
  override ponerEnSalaEspera() {
    return EstadoTurno.EN_SALA_DE_ESPERA;
  }
  override cancelar() {
    return EstadoTurno.CANCELADO;
  }
  override confirmar(): EstadoTurno {
    return invalida('El turno ya está confirmado.');
  }
  override atender(): EstadoTurno {
    return invalida(
      'El paciente debe registrarse en la sala de espera antes de ser atendido.',
    );
  }
}

export class TurnoEnSalaEsperaState extends TurnoState {
  readonly estado = EstadoTurno.EN_SALA_DE_ESPERA;
  override atender() {
    return EstadoTurno.ATENDIDO;
  }
  override cancelar(): EstadoTurno {
    return invalida(
      'Un paciente en sala de espera ya no puede cancelar el turno.',
    );
  }
  protected override get bloqueo(): string {
    return 'El paciente ya está en la sala de espera.';
  }
}

export class TurnoAtendidoState extends TurnoState {
  readonly estado = EstadoTurno.ATENDIDO;
  protected override get bloqueo(): string {
    return 'Un turno atendido no puede modificarse.';
  }
}

export class TurnoCanceladoState extends TurnoState {
  readonly estado = EstadoTurno.CANCELADO;
  protected override get bloqueo(): string {
    return 'Un turno cancelado no puede avanzar en el flujo de atención.';
  }
}

/** Filas heredadas del modelo anterior de franjas; ya no se crean. */
export class TurnoDisponibleState extends TurnoState {
  readonly estado = EstadoTurno.DISPONIBLE;
  protected override get bloqueo(): string {
    return 'Este horario no tiene un turno reservado.';
  }
}

export function turnoStateFor(estado: EstadoTurno): ITurnoState {
  switch (estado) {
    case EstadoTurno.RESERVADO:
      return new TurnoReservadoState();
    case EstadoTurno.CONFIRMADO:
      return new TurnoConfirmadoState();
    case EstadoTurno.EN_SALA_DE_ESPERA:
      return new TurnoEnSalaEsperaState();
    case EstadoTurno.ATENDIDO:
      return new TurnoAtendidoState();
    case EstadoTurno.CANCELADO:
      return new TurnoCanceladoState();
    default:
      return new TurnoDisponibleState();
  }
}

/** Mapa estado → destinos válidos. Única fuente de verdad para API y front. */
export function tablaTransiciones(): Record<string, EstadoTurno[]> {
  return Object.fromEntries(
    Object.values(EstadoTurno).map((estado) => [
      estado,
      turnoStateFor(estado).transicionesPermitidas(),
    ]),
  );
}
