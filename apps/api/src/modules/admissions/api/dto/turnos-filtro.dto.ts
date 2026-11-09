import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsUUID } from 'class-validator';

export class TurnosFiltroDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador del médico para filtrar los turnos.',
  })
  @IsOptional()
  @IsUUID()
  medicoId?: string;

  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Fecha inicial del período de búsqueda.',
  })
  @IsOptional()
  @IsDateString()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Fecha final del período de búsqueda.',
  })
  @IsOptional()
  @IsDateString()
  hasta?: string;
}