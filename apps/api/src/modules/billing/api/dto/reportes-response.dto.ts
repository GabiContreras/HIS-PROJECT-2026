import { ApiProperty } from '@nestjs/swagger';
import { TipoAtencionFacturable } from '../../domain/tipo-atencion-facturable.js';
import { AGRUPACIONES_PERIODO, type AgrupacionPeriodo } from '../../domain/reportes.js';

export class ImportesCargosDto {
  @ApiProperty({ example: 12, description: 'Cantidad de cargos.' })
  cantidad: number;

  @ApiProperty({ example: 180000, description: 'Suma del importe de los cargos, en pesos.' })
  totalPesos: number;

  @ApiProperty({
    example: 40000,
    description: 'Suma de lo que paga el paciente. Los cargos sin cobertura registrada no aportan.',
  })
  pacientePesos: number;

  @ApiProperty({
    example: 140000,
    description: 'Suma de lo que se reclama al tercero. Los cargos sin cobertura registrada no aportan.',
  })
  terceroPesos: number;
}

export class AnuladosDto {
  @ApiProperty({ example: 2, description: 'Cargos anulados creados en el período.' })
  cantidad: number;

  @ApiProperty({ example: 30000, description: 'Importe de los cargos anulados, en pesos.' })
  totalPesos: number;
}

export class CargosPorPeriodoFilaDto extends ImportesCargosDto {
  @ApiProperty({
    example: '2026-03-10',
    description: 'Día (YYYY-MM-DD) o mes (YYYY-MM) en hora de Buenos Aires.',
  })
  periodo: string;
}

export class ReporteCargosPorPeriodoDto {
  @ApiProperty({ example: '2026-03-01' })
  desde: string;

  @ApiProperty({ example: '2026-03-31' })
  hasta: string;

  @ApiProperty({ enum: AGRUPACIONES_PERIODO, example: 'dia' })
  agrupacion: AgrupacionPeriodo;

  @ApiProperty({ type: ImportesCargosDto, description: 'Suma de las filas.' })
  totales: ImportesCargosDto;

  @ApiProperty({
    type: AnuladosDto,
    description: 'Informativo: los cargos anulados no suman en los totales.',
  })
  anulados: AnuladosDto;

  @ApiProperty({
    type: CargosPorPeriodoFilaDto,
    isArray: true,
    description: 'Ordenadas por período ascendente. Solo los períodos con cargos.',
  })
  filas: CargosPorPeriodoFilaDto[];
}

export class CargosPorMedicoFilaDto extends ImportesCargosDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '550e8400-e29b-41d4-a716-446655440001',
    description: 'Null en la fila "Sin médico asignado" (farmacia, internación y cargos sin turno).',
  })
  medicoId: string | null;

  @ApiProperty({ example: 'Ana Gómez' })
  medico: string;
}

export class ReporteCargosPorMedicoDto {
  @ApiProperty({ example: '2026-03-01' })
  desde: string;

  @ApiProperty({ example: '2026-03-31' })
  hasta: string;

  @ApiProperty({ type: ImportesCargosDto, description: 'Suma de las filas.' })
  totales: ImportesCargosDto;

  @ApiProperty({
    type: AnuladosDto,
    description: 'Informativo: los cargos anulados no suman en los totales.',
  })
  anulados: AnuladosDto;

  @ApiProperty({
    type: CargosPorMedicoFilaDto,
    isArray: true,
    description: 'Ordenadas por importe descendente y, a igual importe, por nombre.',
  })
  filas: CargosPorMedicoFilaDto[];
}

export class CargosPorServicioFilaDto extends ImportesCargosDto {
  @ApiProperty({ enum: TipoAtencionFacturable, example: TipoAtencionFacturable.REGULAR })
  tipoAtencion: TipoAtencionFacturable;
}

export class ReporteCargosPorServicioDto {
  @ApiProperty({ example: '2026-03-01' })
  desde: string;

  @ApiProperty({ example: '2026-03-31' })
  hasta: string;

  @ApiProperty({ type: ImportesCargosDto, description: 'Suma de las filas.' })
  totales: ImportesCargosDto;

  @ApiProperty({
    type: AnuladosDto,
    description: 'Informativo: los cargos anulados no suman en los totales.',
  })
  anulados: AnuladosDto;

  @ApiProperty({
    type: CargosPorServicioFilaDto,
    isArray: true,
    description:
      'Una fila por tipo de atención con cargos, ordenadas por importe descendente y, a igual importe, por tipo.',
  })
  filas: CargosPorServicioFilaDto[];
}

export class OcupacionCamasDto {
  @ApiProperty({ example: 20 })
  camasActivas: number;

  @ApiProperty({ example: 14 })
  camasOcupadas: number;

  @ApiProperty({ example: 70, description: 'Porcentaje de camas activas ocupadas, con dos decimales.' })
  porcentajeOcupacion: number;
}

export class ConsumoInsumoFilaDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440003' })
  insumoId: string;

  @ApiProperty({ example: 'Paracetamol 500 mg' })
  nombre: string;

  @ApiProperty({ example: 'comprimido' })
  unidadMedida: string;

  @ApiProperty({ example: 25, description: 'Unidades descontadas en el período.' })
  cantidadTotal: number;

  @ApiProperty({ example: 5, description: 'Parte descontada manualmente.' })
  cantidadManual: number;

  @ApiProperty({ example: 20, description: 'Parte descontada por administración de medicación.' })
  cantidadMedicacion: number;
}

export class ReporteConsumoInsumosDto {
  @ApiProperty({ example: '2026-03-01' })
  desde: string;

  @ApiProperty({ example: '2026-03-31' })
  hasta: string;

  @ApiProperty({
    type: ConsumoInsumoFilaDto,
    isArray: true,
    description:
      'Solo insumos con consumo en el período, ordenados por cantidad total descendente y, a igual cantidad, por nombre. Las reposiciones no cuentan.',
  })
  filas: ConsumoInsumoFilaDto[];
}
