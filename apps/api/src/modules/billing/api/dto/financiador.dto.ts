import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { CoverageType } from '../../../../shared/events/coverage-type.js';
import {
  FINANCIADOR_TIPOS,
  type FinanciadorTipo,
} from '../../domain/financiador-tipo.js';

const NOMBRE_MAX_LENGTH = 100;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CrearFinanciadorDto {
  @ApiProperty({ example: 'OSDE', maxLength: NOMBRE_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOMBRE_MAX_LENGTH)
  nombre: string;

  @ApiProperty({
    enum: FINANCIADOR_TIPOS,
    example: CoverageType.PREPAID,
    description: 'Obra social pública o medicina prepaga. Particular no tiene financiador.',
  })
  @IsIn(FINANCIADOR_TIPOS)
  tipo: FinanciadorTipo;
}

export class ActualizarFinanciadorDto {
  @ApiPropertyOptional({ example: 'OSDE', maxLength: NOMBRE_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOMBRE_MAX_LENGTH)
  nombre?: string;

  @ApiPropertyOptional({ enum: FINANCIADOR_TIPOS })
  @IsOptional()
  @IsIn(FINANCIADOR_TIPOS)
  tipo?: FinanciadorTipo;

  @ApiPropertyOptional({ description: 'false da de baja al financiador sin borrarlo.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class CrearPlanDto {
  @ApiProperty({ example: '210', maxLength: NOMBRE_MAX_LENGTH })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOMBRE_MAX_LENGTH)
  nombre: string;
}

export class ActualizarPlanDto {
  @ApiPropertyOptional({ example: '210', maxLength: NOMBRE_MAX_LENGTH })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(NOMBRE_MAX_LENGTH)
  nombre?: string;

  @ApiPropertyOptional({ description: 'false da de baja al plan sin borrarlo.' })
  @IsOptional()
  @IsBoolean()
  activo?: boolean;
}

export class PlanResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ format: 'uuid' })
  financiadorId: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty()
  activo: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class FinanciadorResponseDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nombre: string;

  @ApiProperty({ enum: FINANCIADOR_TIPOS })
  tipo: FinanciadorTipo;

  @ApiProperty()
  activo: boolean;

  @ApiProperty()
  createdAt: Date;
}

export class FinanciadorConPlanesDto extends FinanciadorResponseDto {
  @ApiProperty({ type: PlanResponseDto, isArray: true })
  planes: PlanResponseDto[];
}
