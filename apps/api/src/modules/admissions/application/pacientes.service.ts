import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import { validateBirthDate } from '../domain/paciente.rules.js';
import {
  DocumentoDuplicadoError,
  PACIENTES_REPOSITORY,
  type PacienteData,
  type PacientesRepository,
} from '../domain/ports/pacientes.repository.js';

const SEARCH_LIMIT = 50;

export interface CrearPacienteInput {
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string;
  tipoCobertura: CoverageType;
  entidadCobertura?: string;
}

export interface ActualizarPacienteInput {
  nombre?: string;
  apellido?: string;
  documento?: string;
  fechaNacimiento?: string;
  telefono?: string;
}

export interface CoberturaInput {
  tipoCobertura: CoverageType;
  entidadCobertura?: string;
}

export function normalizeCoverage(input: CoberturaInput): {
  tipoCobertura: CoverageType;
  entidadCobertura: string | null;
} {
  const entidad = input.entidadCobertura?.trim() || null;
  switch (input.tipoCobertura) {
    case CoverageType.PREPAID:
      if (!entidad) {
        throw new BadRequestException('Indicá la medicina prepaga del paciente.');
      }
      return { tipoCobertura: input.tipoCobertura, entidadCobertura: entidad };
    case CoverageType.PUBLIC_INSURANCE:
      return { tipoCobertura: input.tipoCobertura, entidadCobertura: entidad };
    default:
      return { tipoCobertura: CoverageType.SELF_PAY, entidadCobertura: null };
  }
}

function assertBirthDate(birth: string, today: string): void {
  const problem = validateBirthDate(birth, today);
  if (problem === 'FUTURE') {
    throw new BadRequestException('La fecha de nacimiento no puede ser futura.');
  }
  if (problem === 'TOO_OLD') {
    throw new BadRequestException('La fecha de nacimiento no es válida.');
  }
}

@Injectable()
export class PacientesService {
  constructor(
    @Inject(PACIENTES_REPOSITORY)
    private readonly repository: PacientesRepository,
  ) {}

  search(term?: string): Promise<PacienteData[]> {
    return this.repository.search(term?.trim() || undefined, SEARCH_LIMIT);
  }

  async get(id: string): Promise<PacienteData> {
    const paciente = await this.repository.findById(id);
    if (!paciente) throw new NotFoundException('No se encontró el paciente.');
    return paciente;
  }

  async create(
    input: CrearPacienteInput,
    today = new Date().toISOString().slice(0, 10),
  ): Promise<PacienteData> {
    const birth = input.fechaNacimiento.slice(0, 10);
    assertBirthDate(birth, today);

    const coverage = normalizeCoverage(input);

    if (await this.repository.findByDocumento(input.documento)) {
      throw new ConflictException('Ya existe un paciente con ese documento.');
    }

    try {
      return await this.repository.create({
        nombre: input.nombre,
        apellido: input.apellido,
        documento: input.documento,
        fechaNacimiento: birth,
        telefono: input.telefono ?? null,
        ...coverage,
      });
    } catch (error) {
      if (error instanceof DocumentoDuplicadoError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async update(
    id: string,
    input: ActualizarPacienteInput,
    today = new Date().toISOString().slice(0, 10),
  ): Promise<PacienteData> {
    const changes: ActualizarPacienteInput = {};
    if (input.nombre !== undefined) changes.nombre = input.nombre;
    if (input.apellido !== undefined) changes.apellido = input.apellido;
    if (input.documento !== undefined) changes.documento = input.documento;
    if (input.telefono !== undefined) changes.telefono = input.telefono;
    if (input.fechaNacimiento !== undefined) {
      const birth = input.fechaNacimiento.slice(0, 10);
      assertBirthDate(birth, today);
      changes.fechaNacimiento = birth;
    }
    if (Object.keys(changes).length === 0) {
      throw new BadRequestException('Indicá al menos un dato para actualizar.');
    }

    if (changes.documento) {
      const existing = await this.repository.findByDocumento(changes.documento);
      if (existing && existing.id !== id) {
        throw new ConflictException('Ya existe un paciente con ese documento.');
      }
    }

    try {
      const updated = await this.repository.update(id, changes);
      if (!updated) throw new NotFoundException('No se encontró el paciente.');
      return updated;
    } catch (error) {
      if (error instanceof DocumentoDuplicadoError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  async updateCoverage(id: string, input: CoberturaInput): Promise<PacienteData> {
    const { tipoCobertura, entidadCobertura } = normalizeCoverage(input);
    const updated = await this.repository.updateCoverage(
      id,
      tipoCobertura,
      entidadCobertura,
    );
    if (!updated) throw new NotFoundException('No se encontró el paciente.');
    return updated;
  }
}