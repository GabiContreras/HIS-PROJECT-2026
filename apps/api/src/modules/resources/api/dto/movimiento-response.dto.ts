import { ApiProperty } from '@nestjs/swagger';
import {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../../domain/inventory-movement.js';

export class MovimientoResponseDto {
  @ApiProperty({ example: '7b1f3c52-9d3e-4c63-8a43-0f6a5f2b9c11' })
  id: string;

  @ApiProperty({ enum: TipoMovimientoInventario, example: TipoMovimientoInventario.DESCUENTO })
  tipo: TipoMovimientoInventario;

  @ApiProperty({ example: 3 })
  cantidad: number;

  @ApiProperty({ example: 7, description: 'Stock disponible del insumo después del movimiento.' })
  stockResultante: number;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Cuenta que realizó el movimiento; null cuando lo hizo el sistema.',
  })
  usuarioId: string | null;

  @ApiProperty({ enum: OrigenMovimientoInventario, example: OrigenMovimientoInventario.MANUAL })
  origen: OrigenMovimientoInventario;

  @ApiProperty({
    nullable: true,
    type: String,
    example: '0c9d2d1a-3f6b-4d51-9a2e-6f1d5f0f7a10',
    description: 'Identificador del registro que originó el movimiento, por ejemplo la administración de medicación.',
  })
  referenciaId: string | null;

  @ApiProperty({ nullable: true, type: String, example: 'Reposición por compra semanal' })
  motivo: string | null;

  @ApiProperty({ example: '2026-11-15T14:30:00.000Z' })
  fecha: string;
}
