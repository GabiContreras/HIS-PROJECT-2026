import { ApiProperty } from '@nestjs/swagger';
import { MedicoTurnoResponseDto } from './medico-turno-response.dto.js';
import { PacienteTurnoResponseDto } from './paciente-turno-response.dto.js';

export class EsperaSummaryResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador único del registro de espera.',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: '2026-11-10',
    description: 'Fecha para la que se solicita el turno.',
    format: 'date',
  })
  fecha: string;

  @ApiProperty({
    example: 2,
    description: 'Posición actual del paciente en la lista de espera.',
  })
  posicion: number;

  @ApiProperty({
    example: '2026-11-06T19:30:00.000Z',
    description: 'Fecha y hora en que se creó el registro.',
    format: 'date-time',
  })
  creadoEn: Date;

  @ApiProperty({
    type: () => MedicoTurnoResponseDto,
    description: 'Médico solicitado.',
  })
  medico: MedicoTurnoResponseDto;

  @ApiProperty({
    type: () => PacienteTurnoResponseDto,
    description: 'Paciente que integra la lista de espera.',
  })
  paciente: PacienteTurnoResponseDto;
}