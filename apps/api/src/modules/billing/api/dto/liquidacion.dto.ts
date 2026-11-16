import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { LIMITE_MAXIMO, LIMITE_POR_DEFECTO } from '../../domain/filtro-cargos.js';
import { TipoAtencionFacturable } from '../../domain/tipo-atencion-facturable.js';

export class CrearLiquidacionDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440010',
    description: 'Financiador a liquidar.',
  })
  @IsUUID()
  financiadorId: string;

  @ApiProperty({
    example: '2026-03-01',
    description:
      'Primer día del período (inclusive), formato YYYY-MM-DD, en hora de Buenos Aires, sobre la fecha de creación del cargo.',
  })
  @IsString()
  desde: string;

  @ApiProperty({
    example: '2026-03-31',
    description:
      'Último día del período (inclusive), formato YYYY-MM-DD, en hora de Buenos Aires, sobre la fecha de creación del cargo.',
  })
  @IsString()
  hasta: string;
}

export class LiquidacionesQueryDto {
  @ApiPropertyOptional({
    example: '550e8400-e29b-41d4-a716-446655440010',
    description: 'Solo las liquidaciones de ese financiador.',
  })
  @IsOptional()
  @IsUUID()
  financiadorId?: string;

  @ApiPropertyOptional({
    example: LIMITE_POR_DEFECTO,
    default: LIMITE_POR_DEFECTO,
    minimum: 1,
    maximum: LIMITE_MAXIMO,
    description: 'Cantidad máxima de liquidaciones por página.',
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
    description: 'Cantidad de liquidaciones a saltear antes de la página.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number;
}

export class LiquidacionDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440020', description: 'Identificador de la liquidación.' })
  id: string;

  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440010', description: 'Financiador liquidado.' })
  financiadorId: string;

  @ApiProperty({ example: 'Obra Social Ejemplo', description: 'Nombre del financiador liquidado.' })
  financiadorNombre: string;

  @ApiProperty({ example: '2026-03-01', description: 'Primer día del período (inclusive).' })
  desde: string;

  @ApiProperty({ example: '2026-03-31', description: 'Último día del período (inclusive).' })
  hasta: string;

  @ApiProperty({ example: 12, description: 'Cantidad de cargos incluidos.' })
  cantidadCargos: number;

  @ApiProperty({ example: 180000, description: 'Suma del importe a cargo del tercero de los cargos incluidos.' })
  totalPesos: number;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440030',
    nullable: true,
    type: String,
    description: 'Usuario que generó la liquidación; null si la cuenta se eliminó.',
  })
  usuarioId: string | null;

  @ApiProperty({ example: '2026-04-01T13:00:00.000Z', description: 'Fecha de creación de la liquidación.' })
  createdAt: Date;
}

export class LiquidacionesPaginaDto {
  @ApiProperty({
    type: LiquidacionDto,
    isArray: true,
    description: 'Liquidaciones de la página, de la más reciente a la más antigua.',
  })
  items: LiquidacionDto[];

  @ApiProperty({ example: 8, description: 'Cantidad de liquidaciones que cumplen el filtro, sin paginar.' })
  total: number;

  @ApiProperty({ example: 50, description: 'Límite aplicado a la página.' })
  limit: number;

  @ApiProperty({ example: 0, description: 'Desplazamiento aplicado a la página.' })
  offset: number;
}

export class LiquidacionCargoDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440040', description: 'Identificador del cargo.' })
  id: string;

  @ApiProperty({ example: 'Insumos de Farmacia', nullable: true, type: String, description: 'Concepto del cargo.' })
  concepto: string | null;

  @ApiProperty({ enum: TipoAtencionFacturable, example: TipoAtencionFacturable.REGULAR, description: 'Tipo de atención.' })
  tipoAtencion: TipoAtencionFacturable;

  @ApiProperty({ example: '2026-03-10T15:30:00.000Z', description: 'Fecha de creación del cargo.' })
  createdAt: Date;

  @ApiProperty({ example: 15000, description: 'Importe total del cargo.' })
  importePesos: number;

  @ApiProperty({ example: 12000, nullable: true, type: Number, description: 'Importe a cargo del tercero.' })
  importeTerceroPesos: number | null;
}

export class LiquidacionDetalleDto extends LiquidacionDto {
  @ApiProperty({
    type: LiquidacionCargoDto,
    isArray: true,
    description: 'Cargos incluidos en la liquidación, del más antiguo al más reciente.',
  })
  cargos: LiquidacionCargoDto[];
}
