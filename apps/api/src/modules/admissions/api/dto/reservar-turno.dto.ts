import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsUUID } from 'class-validator';

/** Reserva de un horario calculado (turno regular o entreturno). */
export class ReservarTurnoDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador del médico que atenderá al paciente.',
  })
  @IsUUID()
  medicoId: string;

  @ApiProperty({
    example: '2026-11-10T09:30:00.000Z',
    description: 'Fecha y hora del turno en formato ISO 8601.',
  })
  @IsDateString()
  fechaHora: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Identificador del paciente que solicita el turno.',
  })
  @IsUUID()
  pacienteId: string;
}