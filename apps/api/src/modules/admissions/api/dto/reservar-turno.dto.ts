import { IsDateString, IsUUID } from 'class-validator';

/** Reserva de un horario calculado (turno regular o entreturno). */
export class ReservarTurnoDto {
  @IsUUID()
  medicoId: string;

  @IsDateString()
  fechaHora: string;

  @IsUUID()
  pacienteId: string;
}
