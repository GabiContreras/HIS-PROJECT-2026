import { IsDateString, IsUUID } from 'class-validator';

export class CrearTurnoDto {
  @IsUUID()
  medicoId: string;

  @IsDateString()
  fechaHora: string;
}
