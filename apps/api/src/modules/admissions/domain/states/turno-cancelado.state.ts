import { BadRequestException } from '@nestjs/common';
import { ITurnoState } from './turno-state.interface.js';

export class TurnoCanceladoState implements ITurnoState {
  constructor(private turnoContext: any) {}

  confirmar(): void {
    throw new BadRequestException('Un turno cancelado no puede ser confirmado.');
  }

  ponerEnSalaEspera(): void {
    throw new BadRequestException('Un turno cancelado no puede pasar a sala de espera.');
  }

  atender(): void {
    throw new BadRequestException('Error de negocio: Un turno cancelado no puede avanzar al estado Atendido.');
  }

  cancelar(): void {
    throw new BadRequestException('El turno ya se encuentra cancelado.');
  }
}