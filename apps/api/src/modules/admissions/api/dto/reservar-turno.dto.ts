import { IsUUID } from 'class-validator';

export class ReservarTurnoDto {
  @IsUUID()
  pacienteId: string;
}
