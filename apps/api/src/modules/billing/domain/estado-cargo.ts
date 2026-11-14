export enum EstadoCargo {
  PENDIENTE = 'PENDIENTE',
  FACTURADO = 'FACTURADO',
  PAGADO = 'PAGADO',
  ANULADO = 'ANULADO',
}

export class InvalidCargoTransitionError extends Error {
  constructor(
    readonly from: EstadoCargo,
    readonly action: 'pagar' | 'anular',
  ) {
    super(`No se puede ${action} un cargo en estado ${from}.`);
  }
}

export interface CargoState {
  readonly estado: EstadoCargo;
  pagar(): CargoState;
  anular(): CargoState;
}

abstract class BaseCargoState implements CargoState {
  abstract readonly estado: EstadoCargo;

  pagar(): CargoState {
    throw new InvalidCargoTransitionError(this.estado, 'pagar');
  }

  anular(): CargoState {
    throw new InvalidCargoTransitionError(this.estado, 'anular');
  }
}

class PendienteState extends BaseCargoState {
  readonly estado = EstadoCargo.PENDIENTE;

  override pagar(): CargoState {
    return new PagadoState();
  }

  override anular(): CargoState {
    return new AnuladoState();
  }
}

class FacturadoState extends BaseCargoState {
  readonly estado = EstadoCargo.FACTURADO;

  override pagar(): CargoState {
    return new PagadoState();
  }

  override anular(): CargoState {
    return new AnuladoState();
  }
}

class PagadoState extends BaseCargoState {
  readonly estado = EstadoCargo.PAGADO;
}

class AnuladoState extends BaseCargoState {
  readonly estado = EstadoCargo.ANULADO;
}

const STATE_BY_ESTADO: Record<EstadoCargo, () => CargoState> = {
  [EstadoCargo.PENDIENTE]: () => new PendienteState(),
  [EstadoCargo.FACTURADO]: () => new FacturadoState(),
  [EstadoCargo.PAGADO]: () => new PagadoState(),
  [EstadoCargo.ANULADO]: () => new AnuladoState(),
};

export function cargoStateFor(estado: EstadoCargo): CargoState {
  return STATE_BY_ESTADO[estado]();
}
