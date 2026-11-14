import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Matches, Min, MaxLength } from 'class-validator';

export const NON_BLANK_PATTERN = /\S/;
export const INSUMO_NOMBRE_MAX_LENGTH = 150;
export const INSUMO_UNIDAD_MEDIDA_MAX_LENGTH = 20;

export class CrearInsumoDto {
  @ApiProperty({
    example: 'Ibuprofeno 400mg',
    maxLength: INSUMO_NOMBRE_MAX_LENGTH,
    description: 'Nombre único del insumo.',
  })
  @IsString({ message: 'El nombre debe ser un texto.' })
  @Matches(NON_BLANK_PATTERN, { message: 'El nombre es obligatorio.' })
  @MaxLength(INSUMO_NOMBRE_MAX_LENGTH, { message: 'El nombre supera el largo permitido.' })
  nombre: string;

  @ApiProperty({
    example: 'comprimido',
    maxLength: INSUMO_UNIDAD_MEDIDA_MAX_LENGTH,
    description: 'Unidad de medida del insumo.',
  })
  @IsString({ message: 'La unidad de medida debe ser un texto.' })
  @Matches(NON_BLANK_PATTERN, { message: 'La unidad de medida es obligatoria.' })
  @MaxLength(INSUMO_UNIDAD_MEDIDA_MAX_LENGTH, { message: 'La unidad de medida supera el largo permitido.' })
  unidadMedida: string;

  @ApiPropertyOptional({
    example: 250,
    minimum: 0,
    default: 0,
    description: 'Precio por unidad en pesos enteros.',
  })
  @IsOptional()
  @IsInt({ message: 'El precio debe ser un número entero.' })
  @Min(0, { message: 'El precio no puede ser negativo.' })
  precioPesos?: number;

  @ApiPropertyOptional({
    example: 20,
    minimum: 0,
    default: 0,
    description: 'Stock mínimo deseado del insumo.',
  })
  @IsOptional()
  @IsInt({ message: 'El stock mínimo debe ser un número entero.' })
  @Min(0, { message: 'El stock mínimo no puede ser negativo.' })
  stockMinimo?: number;
}
