import { ApiProperty } from '@nestjs/swagger';
import { EstadoTriaje } from '../../../../entities/triaje.entity.js';
import { NivelTriage } from './crear-triage.dto.js';

export class TriageResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000', format: 'uuid' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440002', format: 'uuid' })
  pacienteId: string;

  @ApiProperty({ example: 'Pérez, Juan', description: 'Apellido, Nombre del paciente.' })
  paciente: string;

  @ApiProperty({ example: 'Dolor precordial agudo y dificultad respiratoria' })
  motivo: string;

  @ApiProperty({ enum: NivelTriage, example: NivelTriage.ROJO })
  nivel: NivelTriage;

  @ApiProperty({ enum: EstadoTriaje, example: EstadoTriaje.EN_COLA })
  estado: EstadoTriaje;

  @ApiProperty({ example: '2026-11-10T09:30:00.000Z', format: 'date-time' })
  llegadaAt: Date;
}
