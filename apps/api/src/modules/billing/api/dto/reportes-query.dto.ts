import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import { AGRUPACIONES_PERIODO, type AgrupacionPeriodo } from '../../domain/reportes.js';

export class PeriodoQueryDto {
  @ApiProperty({
    example: '2026-03-01',
    description:
      'Primer día del período (inclusive), formato YYYY-MM-DD, en hora de Buenos Aires.',
  })
  @IsString()
  desde: string;

  @ApiProperty({
    example: '2026-03-31',
    description:
      'Último día del período (inclusive), formato YYYY-MM-DD, en hora de Buenos Aires.',
  })
  @IsString()
  hasta: string;
}

export class CargosPorPeriodoQueryDto extends PeriodoQueryDto {
  @ApiPropertyOptional({
    enum: AGRUPACIONES_PERIODO,
    default: 'dia',
    description: 'Agrupa los cargos por día o por mes. Por defecto, día.',
  })
  @IsOptional()
  @IsIn(AGRUPACIONES_PERIODO)
  agrupacion?: AgrupacionPeriodo;
}
