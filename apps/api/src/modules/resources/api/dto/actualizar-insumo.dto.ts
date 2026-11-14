import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Min, MaxLength } from 'class-validator';
import { INSUMO_UNIDAD_MEDIDA_MAX_LENGTH, NON_BLANK_PATTERN } from './crear-insumo.dto.js';

export class ActualizarInsumoDto {
  @ApiPropertyOptional({
    example: 'comprimido',
    maxLength: INSUMO_UNIDAD_MEDIDA_MAX_LENGTH,
    description: 'Nueva unidad de medida.',
  })
  @IsOptional()
  @IsString({ message: 'La unidad de medida debe ser un texto.' })
  @Matches(NON_BLANK_PATTERN, { message: 'La unidad de medida no puede estar vacía.' })
  @MaxLength(INSUMO_UNIDAD_MEDIDA_MAX_LENGTH, { message: 'La unidad de medida supera el largo permitido.' })
  unidadMedida?: string;

  @ApiPropertyOptional({
    example: 300,
    minimum: 0,
    description: 'Nuevo precio por unidad en pesos enteros.',
  })
  @IsOptional()
  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  precioPesos?: number;

  @ApiPropertyOptional({
    example: 25,
    minimum: 0,
    description: 'Nuevo stock mínimo deseado.',
  })
  @IsOptional()
  @IsInt({ message: 'El stock mínimo debe ser un número entero.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  stockMinimo?: number;
}
