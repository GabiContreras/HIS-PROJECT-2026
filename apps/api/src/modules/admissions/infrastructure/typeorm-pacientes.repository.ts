
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Paciente as PacienteEntity } from '../../../entities/paciente.entity.js';
import type { Paciente } from '../domain/paciente.js';
import { DocumentoDuplicadoError } from '../domain/documento-duplicado.error.js';
import type { PacientesRepository } from '../domain/pacientes.repository.js';

@Injectable()
export class TypeOrmPacientesRepository implements PacientesRepository {
  constructor(
    @InjectRepository(PacienteEntity)
    private readonly repository: Repository<PacienteEntity>,
  ) {}

  async buscarPorDocumento(documento: string): Promise<Paciente | null> {
    const entidad = await this.repository.findOne({
      where: { documento },
    });

    if (!entidad) {
      return null;
    }

    return this.toDomain(entidad);
  }


  async guardar(paciente: Paciente): Promise<Paciente> {
    const entidad = this.repository.create({
      ...(paciente.id ? { id: paciente.id } : {}),
      nombre: paciente.nombre,
      apellido: paciente.apellido,
      documento: paciente.documento,
      fechaNacimiento: paciente.fechaNacimiento,
      telefono: paciente.telefono ?? undefined,
    });

    try {
      const guardado = await this.repository.save(entidad);
      return this.toDomain(guardado);
    } catch (error: unknown) {
      if (
        error instanceof QueryFailedError &&
        typeof error.driverError === 'object' &&
        error.driverError !== null &&
        'code' in error.driverError &&
        error.driverError.code === '23505' &&
        'constraint' in error.driverError &&
        error.driverError.constraint === 'uq_pacientes_documento'
      ) {
        throw new DocumentoDuplicadoError();
      }

      throw error;
    }
 }

  private toDomain(entidad: PacienteEntity): Paciente {
    return {
      id: entidad.id,
      nombre: entidad.nombre,
      apellido: entidad.apellido,
      documento: entidad.documento,
      fechaNacimiento: entidad.fechaNacimiento,
      telefono: entidad.telefono,
    };
  }
}
