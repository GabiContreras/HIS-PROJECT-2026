import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { CoverageType } from '../../../../shared/events/coverage-type.js';
import { PaginacionDto } from './paginacion.dto.js';

export class PacientesFiltroDto extends PaginacionDto {
  @ApiPropertyOptional({
    example: 'Ada',
    description: 'Texto para buscar pacientes por nombre, apellido o documento.',
    maxLength: 60,
  })
  @IsOptional()
  @IsString()
  @MaxLength(60)
  q?: string;

  @ApiPropertyOptional({ enum: CoverageType, description: 'Filtra por tipo de cobertura.' })
  @IsOptional()
  @IsEnum(CoverageType)
  tipoCobertura?: CoverageType;
}