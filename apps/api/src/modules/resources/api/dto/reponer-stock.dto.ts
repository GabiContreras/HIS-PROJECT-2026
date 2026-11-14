import { ApiProperty } from '@nestjs/swagger';
import { IsInt, Max, Min } from 'class-validator';

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
}
