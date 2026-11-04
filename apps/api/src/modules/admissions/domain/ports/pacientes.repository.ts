import { CoverageType } from '../../../../shared/events/coverage-type.js';

export interface PacienteData {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono: string | null;
  tipoCobertura: CoverageType;
  /** Prepaga u obra social; null si es particular. */
  entidadCobertura: string | null;
}

export type NuevoPaciente = Omit<PacienteData, 'id'>;

export class DocumentoDuplicadoError extends Error {
  constructor() {
    super('Ya existe un paciente con ese documento.');
  }
}

export interface PacientesRepository {
  search(term: string | undefined, limit: number): Promise<PacienteData[]>;
  findById(id: string): Promise<PacienteData | null>;
  findByDocumento(documento: string): Promise<PacienteData | null>;
  /** Lanza DocumentoDuplicadoError si el documento ya existe. */
  create(data: NuevoPaciente): Promise<PacienteData>;
  /** null si el paciente no existe. */
  updateCoverage(
    id: string,
    tipoCobertura: CoverageType,
    entidadCobertura: string | null,
  ): Promise<PacienteData | null>;
}

export const PACIENTES_REPOSITORY = Symbol('PACIENTES_REPOSITORY');
