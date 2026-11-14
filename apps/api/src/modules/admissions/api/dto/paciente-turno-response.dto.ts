import { ApiProperty } from '@nestjs/swagger';

export class PacienteTurnoResponseDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador único del paciente.',
    format: 'uuid',
  })
  id: string;

  @ApiProperty({
    example: 'María',
    description: 'Nombre del paciente.',
  })
  nombre: string;

  @ApiProperty({
    example: 'González',
    description: 'Apellido del paciente.',
  })
  apellido: string;
}