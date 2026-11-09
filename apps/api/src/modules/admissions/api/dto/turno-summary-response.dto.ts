import { ApiProperty } from '@nestjs/swagger';
import { EstadoTurno } from '../../infrastructure/persistence/entities/turno.entity.js';
import { MedicoTurnoResponseDto } from './medico-turno-response.dto.js';

export class TurnoSummaryResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador único del turno.',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: '2026-11-10T09:30:00.000Z',
    description: 'Fecha y hora del turno.',
    format: 'date-time',
  })
  fechaHora: Date;

  @ApiProperty({
    example: 30,
    description: 'Duración del turno en minutos.',
  })
  duracionMinutos: number;

  @ApiProperty({
    enum: EstadoTurno,
    example: EstadoTurno.RESERVADO,
    description: 'Estado actual del turno.',
  })
  estado: EstadoTurno;

  @ApiProperty({
    example: false,
    description: 'Indica si el turno es urgente.',
  })
  urgente: boolean;

  @ApiProperty({
    type: () => MedicoTurnoResponseDto,
    description: 'Médico asignado al turno.',
  })
  medico: MedicoTurnoResponseDto;
}