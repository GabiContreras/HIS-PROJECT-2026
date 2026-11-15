import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';
import { MOTIVO_MOVIMIENTO_MAX_LENGTH } from '../../domain/inventory-movement.js';

export class DescontarStockDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador UUID del insumo al que se le descontará stock.',
  })
  @IsUUID('all', { message: 'El ID del insumo debe ser un UUID válido.' })
  insumoId: string;

  @ApiProperty({
    example: 3,
    minimum: 1,
    description: 'Cantidad entera de unidades que se desea descontar.',
  })
  @IsInt({ message: 'La cantidad debe ser un número entero.' })
  @Min(1, { message: 'La cantidad debe ser mayor que cero.' })
  cantidad: number;

  @ApiPropertyOptional({
    example: 'Uso en curación',
    maxLength: MOTIVO_MOVIMIENTO_MAX_LENGTH,
    description: 'Motivo del descuento, opcional.',
  })
  @IsOptional()
  @IsString({ message: 'El motivo debe ser un texto.' })
  @MaxLength(MOTIVO_MOVIMIENTO_MAX_LENGTH, {
    message: `El motivo no puede superar ${MOTIVO_MOVIMIENTO_MAX_LENGTH} caracteres.`,
  })
  motivo?: string;
}
