import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import { Paciente } from '../../../entities/paciente.entity.js';
import {
  DocumentoDuplicadoError,
  type NuevoPaciente,
  type PacienteData,
  type PacientesRepository,
} from '../domain/ports/pacientes.repository.js';

const UNIQUE_VIOLATION = '23505';

function toData(entity: Paciente): PacienteData {
  return {
    id: entity.id,
    nombre: entity.nombre,
    apellido: entity.apellido,
    documento: entity.documento,
    fechaNacimiento: entity.fechaNacimiento,
    telefono: entity.telefono ?? null,
  };
}

@Injectable()
export class PacientesTypeOrmRepository implements PacientesRepository {
  constructor(
    @InjectRepository(Paciente)
    private readonly pacientes: Repository<Paciente>,
  ) {}

  async search(
    term: string | undefined,
    limit: number,
  ): Promise<PacienteData[]> {
    const query = this.pacientes
      .createQueryBuilder('paciente')
      .orderBy('paciente.apellido', 'ASC')
      .addOrderBy('paciente.nombre', 'ASC')
      .limit(limit);

    if (term) {
      // Escapa los comodines de LIKE para buscar "%" o "_" como texto.
      const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where(
            "CONCAT(paciente.nombre, ' ', paciente.apellido) ILIKE :pattern",
            { pattern },
          )
            .orWhere(
              "CONCAT(paciente.apellido, ' ', paciente.nombre) ILIKE :pattern",
              { pattern },
            )
            .orWhere('paciente.documento ILIKE :pattern', { pattern });
        }),
      );
    }
    return (await query.getMany()).map(toData);
  }

  async findById(id: string): Promise<PacienteData | null> {
    const entity = await this.pacientes.findOne({ where: { id } });
    return entity ? toData(entity) : null;
  }

  async findByDocumento(documento: string): Promise<PacienteData | null> {
    const entity = await this.pacientes.findOne({ where: { documento } });
    return entity ? toData(entity) : null;
  }

  async create(data: NuevoPaciente): Promise<PacienteData> {
    try {
      const saved = await this.pacientes.save(
        this.pacientes.create({
          ...data,
          telefono: data.telefono ?? undefined,
        }),
      );
      return toData(saved);
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error.driverError as { code?: string } | undefined)?.code ===
          UNIQUE_VIOLATION
      ) {
        throw new DocumentoDuplicadoError();
      }
      throw error;
    }
  }
}
