import { IsEnum } from 'class-validator';
import { EstadoTurno } from '../../../../entities/turno.entity.js';

export class TransicionTurnoDto {
  @IsEnum(EstadoTurno)
  estado: EstadoTurno;
}
