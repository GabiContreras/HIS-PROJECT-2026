import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';
import { MOTIVO_MOVIMIENTO_MAX_LENGTH } from '../../domain/inventory-movement.js';

export const REPOSICION_MAX_UNIDADES = 10000;

export class ReponerStockDto {
  @ApiProperty({
    example: 20,
    minimum: 1,
    maximum: REPOSICION_MAX_UNIDADES,
    description: 'Cantidad entera de unidades que se repone al stock en una sola operación.',
  })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero.' })
  @Max(REPOSICION_MAX_UNIDADES, {
    message: `La cantidad no puede superar ${REPOSICION_MAX_UNIDADES} unidades por reposición.`,
  })
  cantidad: number;

  @ApiPropertyOptional({
    example: 'Compra semanal',
    maxLength: MOTIVO_MOVIMIENTO_MAX_LENGTH,
    description: 'Motivo de la reposición, opcional.',
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser un texto.' })
  @MaxLength(MOTIVO_MOVIMIENTO_MAX_LENGTH, {
    message: `El motivo no puede superar ${MOTIVO_MOVIMIENTO_MAX_LENGTH} caracteres.`,
  })
  motivo?: string;
}
