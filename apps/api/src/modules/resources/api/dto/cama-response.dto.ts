import { ApiProperty } from '@nestjs/swagger';
import { EstadoCama } from '../../domain/estado-cama.enum.js';

export class PacienteResumenDto {
  @ApiProperty({ example: '3f2b8c1e-5d7a-4c1b-9a62-0e8f6d2a1b34' })
  id: string;

  @ApiProperty({ example: 'María' })
  nombre: string;

  @ApiProperty({ example: 'Gómez' })
  apellido: string;

  @ApiProperty({ example: '30123456' })
  documento: string;
}

export class CamaResponseDto {
  @ApiProperty({ example: '9b1d4c7e-2f3a-4e8b-8c55-1a2b3c4d5e6f' })
  id: string;

  @ApiProperty({ example: 'A-12' })
  numero: string;

  @ApiProperty({ example: 'Clínica Médica', nullable: true, type: String })
  sector: string | null;

  @ApiProperty({ enum: EstadoCama, example: EstadoCama.LIBRE })
  estado: EstadoCama;

  @ApiProperty({ type: PacienteResumenDto, nullable: true })
  paciente: PacienteResumenDto | null;

  @ApiProperty({ example: 3, description: 'Versión de la fila (se incrementa en cada cambio)' })
  version: number;
}