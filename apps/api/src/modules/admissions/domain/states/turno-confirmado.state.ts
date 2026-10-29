import { BadRequestException } from '@nestjs/common';
import { ITurnoState } from './turno-state.interface.js';

export class TurnoConfirmadoState implements ITurnoState {
  constructor(private turnoContext: any) {}

  confirmar(): void {
    // Ya está confirmado
  }

  ponerEnSalaEspera(): void {
    this.turnoContext.estado = 'EN_SALA_DE_ESPERA';
    // Aquí dispararías la notificación al consultorio médico correspondiente
  }

  atender(): void {
    throw new BadRequestException('El paciente debe registrarse primero en la sala de espera.');
  }

  cancelar(): void {
    this.turnoContext.estado = 'CANCELADO';
  }
}