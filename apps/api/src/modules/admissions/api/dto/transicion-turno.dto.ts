import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { EstadoTurno } from '../../infrastructure/persistence/entities/turno.entity.js';

export class TransicionTurnoDto {
  @ApiProperty({
    enum: EstadoTurno,
    example: EstadoTurno.ATENDIDO,
    description: 'Nuevo estado al que se desea cambiar el turno.',
  })
  @IsEnum(EstadoTurno)
  estado: EstadoTurno;
}