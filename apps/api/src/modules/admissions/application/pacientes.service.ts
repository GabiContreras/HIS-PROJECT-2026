
import {
  ConflictException,
  Inject,
  Injectable,
} from '@nestjs/common';
import { CrearPacienteDto } from '../api/dto/crear-paciente.dto.js';
import { DocumentoDuplicadoError } from '../domain/documento-duplicado.error.js';
import type { Paciente } from '../domain/paciente.js';
import { PACIENTES_REPOSITORY } from '../domain/pacientes.repository.js';
import type { PacientesRepository } from '../domain/pacientes.repository.js';

@Injectable()
export class PacientesService {
  constructor(
    @Inject(PACIENTES_REPOSITORY)
    private readonly pacientes: PacientesRepository,
  ) {}

  async create(dto: CrearPacienteDto): Promise<Paciente> {
    const existente = await this.pacientes.buscarPorDocumento(
      dto.documento,
    );

    if (existente) {
      throw new ConflictException(
        'Ya existe un paciente con ese documento.',
      );
    }

    const paciente: Paciente = {
      nombre: dto.nombre,
      apellido: dto.apellido,
      documento: dto.documento,
      fechaNacimiento: dto.fechaNacimiento,
      telefono: dto.telefono,
    };

    try {
      return await this.pacientes.guardar(paciente);
    } catch (error: unknown) {
      if (error instanceof DocumentoDuplicadoError) {
        throw new ConflictException(
          'Ya existe un paciente con ese documento.',
        );
      }

      throw error;
    }
  }
}
