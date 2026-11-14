import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID, Matches } from 'class-validator';

const FECHA = /^\d{4}-\d{2}-\d{2}$/;

export class AgregarEsperaDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador del médico.',
  })
  @IsUUID()
  medicoId: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Identificador del paciente.',
  })
  @IsUUID()
  pacienteId: string;

  @ApiProperty({
    example: '2026-11-10',
    description: 'Día de la clínica (AAAA-MM-DD) para el que espera un horario.',
  })
  @Matches(FECHA, { message: 'fecha debe tener el formato AAAA-MM-DD.' })
  fecha: string;
}

export class EsperaFiltroDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Filtrar por identificador del médico.',
  })
  @IsOptional()
  @IsUUID()
  medicoId?: string;

  @ApiPropertyOptional({
    example: '2026-11-10',
    description: 'Filtrar por día de la clínica (AAAA-MM-DD).',
  })
  @IsOptional()
  @Matches(FECHA, { message: 'fecha debe tener el formato AAAA-MM-DD.' })
  fecha?: string;
}