import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { EstadoCargo } from '../../domain/estado-cargo.js';
import { LIMITE_MAXIMO, LIMITE_POR_DEFECTO } from '../../domain/filtro-cargos.js';
import { TipoAtencionFacturable } from '../../domain/tipo-atencion-facturable.js';

export class CargosFiltroQueryDto {
  @ApiPropertyOptional({
    example: '2026-03-01',
    description:
      'Primer día (inclusive), formato YYYY-MM-DD, en hora de Buenos Aires, sobre la fecha de creación del cargo. Sin desde no hay tope inferior.',
  })
  @IsOptional()
  @IsString()
  desde?: string;

  @ApiPropertyOptional({
    example: '2026-03-31',
    description:
      'Último día (inclusive), formato YYYY-MM-DD, en hora de Buenos Aires, sobre la fecha de creación del cargo. Sin hasta no hay tope superior.',
  })
  @IsOptional()
  @IsString()
  hasta?: string;

  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description:
      'Solo los cargos del paciente: por su turno (consultas), su internación o la indicación de la medicación administrada (farmacia).',
  })
  @IsOptional()
  @IsUUID()
  pacienteId?: string;

  @ApiPropertyOptional({ enum: EstadoCargo, description: 'Solo los cargos en ese estado.' })
  @IsOptional()
  @IsEnum(EstadoCargo)
  estado?: EstadoCargo;

  @ApiPropertyOptional({
    enum: TipoAtencionFacturable,
    description: 'Solo los cargos de ese tipo de atención.',
  })
  @IsOptional()
  @IsEnum(TipoAtencionFacturable)
  tipoAtencion?: TipoAtencionFacturable;
}

export class CargosListadoQueryDto extends CargosFiltroQueryDto {
  @ApiPropertyOptional({
    example: LIMITE_POR_DEFECTO,
    default: LIMITE_POR_DEFECTO,
    minimum: 1,
    maximum: LIMITE_MAXIMO,
    description: 'Cantidad máxima de cargos por página.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(LIMITE_MAXIMO)
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    default: 0,
    minimum: 0,
    description: 'Cantidad de cargos a saltear antes de la página.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}
