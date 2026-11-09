import { ApiProperty } from '@nestjs/swagger';

export class MedicoTurnoResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador único del médico.',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: 'Juan',
    description: 'Nombre del médico.',
  })
  nombre: string;

  @ApiProperty({
    example: 'Pérez',
    description: 'Apellido del médico.',
  })
  apellido: string;
}