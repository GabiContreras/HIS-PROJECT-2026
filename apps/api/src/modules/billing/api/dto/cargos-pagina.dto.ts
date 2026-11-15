import { ApiProperty } from '@nestjs/swagger';
import { CargoDetalleDto } from './cargo-detalle.dto.js';

export class CargosPaginaDto {
  @ApiProperty({
    type: CargoDetalleDto,
    isArray: true,
    description: 'Cargos de la página, del más reciente al más antiguo.',
  })
  items: CargoDetalleDto[];

  @ApiProperty({ example: 120, description: 'Cantidad de cargos que cumplen los filtros, sin paginar.' })
  total: number;

  @ApiProperty({ example: 50, description: 'Límite aplicado a la página.' })
  limit: number;

  @ApiProperty({ example: 0, description: 'Desplazamiento aplicado a la página.' })
  offset: number;
}
