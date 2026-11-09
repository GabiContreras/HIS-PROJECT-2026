import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

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
}