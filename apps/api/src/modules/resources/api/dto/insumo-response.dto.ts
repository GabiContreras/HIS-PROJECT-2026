import { ApiProperty } from '@nestjs/swagger';

export class InsumoResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Ibuprofeno 400mg' })
  nombre: string;

  @ApiProperty({ example: 'comprimido' })
  unidadMedida: string;

  @ApiProperty({ example: 0 })
  cantidadDisponible: number;

  @ApiProperty({ example: 250 })
  precioPesos: number;

  @ApiProperty({ example: 20 })
  stockMinimo: number;
}
