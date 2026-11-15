import { CoverageType } from '../../../../shared/events/coverage-type.js';

export interface PacienteData {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono: string | null;
  tipoCobertura: CoverageType;
  entidadCobertura: string | null;
}

export type NuevoPaciente = Omit<PacienteData, 'id'>;

export type ActualizacionPaciente = Partial<
  Omit<PacienteData, 'id' | 'tipoCobertura' | 'entidadCobertura' | 'telefono'>
> & { telefono?: string };

export class DocumentoDuplicadoError extends Error {
  constructor() {
    super('Ya existe un paciente con ese documento.');
  }
}

export interface PacientesRepository {
  search(term: string | undefined, limit: number): Promise<PacienteData[]>;
    searchPage(
    filtro: FiltroPacientes,
    skip: number,
    take: number,
  ): Promise<{ items: PacienteData[]; total: number }>;
  findById(id: string): Promise<PacienteData | null>;
  findByDocumento(documento: string): Promise<PacienteData | null>;
  create(data: NuevoPaciente): Promise<PacienteData>;
  update(id: string, changes: ActualizacionPaciente): Promise<PacienteData | null>;
  updateCoverage(
    id: string,
    tipoCobertura: CoverageType,
    entidadCobertura: string | null,
  ): Promise<PacienteData | null>;
}

export interface FiltroPacientes {
  term?: string;
  tipoCobertura?: CoverageType;
}
export const PACIENTES_REPOSITORY = Symbol('PACIENTES_REPOSITORY');