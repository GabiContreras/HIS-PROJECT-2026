import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const problem = validateBirthDate(birth, today);
    if (problem === 'FUTURE') {
      throw new BadRequestException(
        'La fecha de nacimiento no puede ser futura.',
      );
    }
    if (problem === 'TOO_OLD') {
      throw new BadRequestException('La fecha de nacimiento no es válida.');
    }

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
      });
    } catch (error) {
      // Dos altas simultáneas con el mismo documento: gana una, la otra recibe 409.
      if (error instanceof DocumentoDuplicadoError) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }
}
