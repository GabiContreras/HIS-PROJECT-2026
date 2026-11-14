import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class PacientesFiltroDto {
  @ApiPropertyOptional({
    example: 'Ada',
    description: 'Texto para buscar pacientes por nombre, apellido o documento.',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;
}