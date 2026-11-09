
import { ApiProperty } from '@nestjs/swagger';
import type { Cargo } from '../../infrastructure/persistence/entities/cargo.entity.js';
import type { CoverageType } from '../../../../shared/events/coverage-type.js';

export class CoberturaCargoDto {
  @ApiProperty({
    example: 'PUBLICA',
    description: 'Tipo de cobertura del paciente.',
    nullable: true,
  })
  tipo: CoverageType;

  @ApiProperty({
    example: 'Obra Social Ejemplo',
    description: 'Entidad responsable de la cobertura.',
    nullable: true,
  })
  entidad: string | null;

  @ApiProperty({
    example: 5000,
    description: 'Importe a cargo del paciente.',
    nullable: true,
  })
  pacientePesos: number | null;

  @ApiProperty({
    example: 15000,
    description: 'Importe a cargo de un tercero.',
    nullable: true,
  })
  terceroPesos: number | null;
}

export class MedicoCargoDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440000',
    description: 'Identificador del médico.',
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

export class PacienteCargoDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Identificador del paciente.',
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
}

export class TurnoCargoDto {
  @ApiProperty({
    example: '2026-11-06T10:30:00.000Z',
    description: 'Fecha y hora del turno.',
    format: 'date-time',
  })
  fechaHora: Date;

  @ApiProperty({
    example: 30,
    description: 'Duración del turno en minutos.',
  })
  duracionMinutos: number;

  @ApiProperty({
    example: false,
    description: 'Indica si el turno fue urgente.',
  })
  urgente: boolean;

  @ApiProperty({
    type: MedicoCargoDto,
    description: 'Datos del médico asociado al turno.',
  })
  medico: MedicoCargoDto;

  @ApiProperty({
    type: PacienteCargoDto,
    nullable: true,
    description: 'Datos del paciente asociado al turno.',
  })
  paciente: PacienteCargoDto | null;
}

export class CargoDetalleDto {
  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440002',
    description: 'Identificador del cargo.',
  })
  id: string;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440003',
    description: 'Identificador del turno, si corresponde.',
    nullable: true,
  })
  turnoId: string | null;

  @ApiProperty({
    example: '550e8400-e29b-41d4-a716-446655440004',
    description: 'Identificador de la administración de medicamento, si corresponde.',
    nullable: true,
  })
  administrationId: string | null;

  @ApiProperty({
    example: 'Insumos de Farmacia',
    description: 'Concepto del cargo.',
    nullable: true,
  })
  concepto: string | null;

  @ApiProperty({
    example: 20000,
    description: 'Importe total del cargo en pesos.',
  })
  importePesos: number;

  @ApiProperty({
    example: 'CONSULTA',
    description: 'Tipo de atención facturada.',
  })
  tipoAtencion: Cargo['tipoAtencion'];

  @ApiProperty({
    example: '2026-11-06T10:30:00.000Z',
    description: 'Fecha de creación del cargo.',
    format: 'date-time',
  })
  createdAt: Date;

  @ApiProperty({
    type: CoberturaCargoDto,
    nullable: true,
    description: 'Detalle de la cobertura aplicada al cargo.',
  })
  cobertura: CoberturaCargoDto | null;

  @ApiProperty({
    type: TurnoCargoDto,
    nullable: true,
    description: 'Información del turno asociado al cargo.',
  })
  turno: TurnoCargoDto | null;
}
