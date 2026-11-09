import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';

const MEDIA_HORA = /^([01]\d|2[0-3]):(00|30)$/;

export class HorarioMedicoDto {
  @ApiProperty({
    example: '08:00',
    description: 'Hora de inicio de la jornada laboral. Formato HH:00 o HH:30.',
  })
  @Matches(MEDIA_HORA, { message: 'horaInicio debe ser HH:00 o HH:30.' })
  horaInicio: string;

  @ApiProperty({
    example: '16:00',
    description: 'Hora de finalización de la jornada laboral. Formato HH:00 o HH:30.',
  })
  @Matches(MEDIA_HORA, { message: 'horaFin debe ser HH:00 o HH:30.' })
  horaFin: string;
}