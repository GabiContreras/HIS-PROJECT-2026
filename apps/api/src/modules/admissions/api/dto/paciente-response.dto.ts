import { ApiProperty } from '@nestjs/swagger';
import { CoverageType } from '../../../../shared/events/coverage-type.js';

export class PacienteResponseDto {
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
    example: 'Gómez',
    description: 'Apellido del paciente.',
  })
  apellido: string;

  @ApiProperty({
    example: '35123456',
    description: 'Documento del paciente.',
  })
  documento: string;

  @ApiProperty({
    example: '1995-08-15',
    description: 'Fecha de nacimiento del paciente.',
    format: 'date',
  })
  fechaNacimiento: string;

  @ApiProperty({
    example: '3515551234',
    description: 'Teléfono de contacto. Puede ser nulo.',
    nullable: true,
  })
  telefono: string | null;

  @ApiProperty({
    enum: CoverageType,
    example: CoverageType.PUBLIC_INSURANCE,
    description: 'Tipo de cobertura médica del paciente.',
  })
  tipoCobertura: CoverageType;

  @ApiProperty({
    example: 'Obra Social Ejemplo',
    description: 'Entidad de cobertura. Es nula para pacientes particulares.',
    nullable: true,
  })
  entidadCobertura: string | null;
}