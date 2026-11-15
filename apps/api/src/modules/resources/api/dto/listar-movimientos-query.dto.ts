import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export const MOVIMIENTOS_LIMIT_DEFAULT = 50;
export const MOVIMIENTOS_LIMIT_MAX = 100;

export class ListarMovimientosQueryDto {
  @ApiPropertyOptional({
    example: MOVIMIENTOS_LIMIT_DEFAULT,
    minimum: 1,
    maximum: MOVIMIENTOS_LIMIT_MAX,
    default: MOVIMIENTOS_LIMIT_DEFAULT,
    description: 'Cantidad máxima de movimientos a devolver.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El límite debe ser un número entero.' })
  @Min(1, { message: 'El límite debe ser al menos 1.' })
  @Max(MOVIMIENTOS_LIMIT_MAX, {
    message: `El límite no puede superar ${MOVIMIENTOS_LIMIT_MAX}.`,
  })
  limit?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
    default: 0,
    description: 'Cantidad de movimientos a omitir desde el más reciente.',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'El desplazamiento debe ser un número entero.' })
  @Min(0, { message: 'El desplazamiento no puede ser negativo.' })
  offset?: number;
}
