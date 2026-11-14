import { ApiProperty } from '@nestjs/swagger';
import { EstadoCargo } from '../../domain/estado-cargo.js';

export class CargoEstadoDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Identificador del cargo.',
  })
  id: string;

  @ApiProperty({
    enum: EstadoCargo,
    example: EstadoCargo.PAGADO,
    description: 'Estado del cargo luego de la operación.',
  })
  estado: EstadoCargo;
}
