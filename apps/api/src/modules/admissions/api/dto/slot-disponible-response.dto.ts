import { ApiProperty } from '@nestjs/swagger';
import { MedicoTurnoResponseDto } from './medico-turno-response.dto.js';

export class SlotDisponibleResponseDto {
  @ApiProperty({
    example: '2026-11-10T09:30:00.000Z',
    description: 'Fecha y hora del horario disponible.',
    format: 'date-time',
  })
  fechaHora: Date;

  @ApiProperty({
    example: 30,
    description: 'Duración del turno disponible en minutos.',
  })
  duracionMinutos: number;

  @ApiProperty({
    type: () => MedicoTurnoResponseDto,
    description: 'Médico asociado al horario disponible.',
  })
  medico: MedicoTurnoResponseDto;
}