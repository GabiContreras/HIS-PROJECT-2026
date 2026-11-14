import { ApiProperty } from '@nestjs/swagger';
import { EstadoCama } from '../../domain/estado-cama.enum.js';

/** Campo `data` de cada mensaje de GET /camas/eventos. */
export class BedStreamEventDto {
  @ApiProperty({
    example: 'bed.assigned',
    enum: ['bed.assigned', 'bed.released', 'bed.cleaned', 'bed.blocked', 'bed.unblocked'],
    description: 'Evento que originó el cambio',
  })
  tipo: string;

  @ApiProperty({ example: '9b1d4c7e-2f3a-4e8b-8c55-1a2b3c4d5e6f' })
  camaId: string;

  @ApiProperty({ example: 'A-12' })
  numero: string;

  @ApiProperty({ enum: EstadoCama, example: EstadoCama.OCUPADA, description: 'Estado en el que queda la cama' })
  estado: EstadoCama;

  @ApiProperty({ example: '2026-11-10T13:30:00.000Z', description: 'Momento del cambio' })
  at: string;
}
