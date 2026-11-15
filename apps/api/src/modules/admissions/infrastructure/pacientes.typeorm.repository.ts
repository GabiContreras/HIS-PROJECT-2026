import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import { Paciente } from '../../../entities/paciente.entity.js';
import { CoverageType } from '../../../shared/events/coverage-type.js';
import {
  type ActualizacionPaciente,
  DocumentoDuplicadoError,
  FiltroPacientes,
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
    tipoCobertura: entity.tipoCobertura,
    entidadCobertura: entity.entidadCobertura ?? null,
  };
}

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
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
    const rows = await this.buildQuery({ term }).limit(limit).getMany();
    return rows.map(toData);
  }

  async searchPage(
    filtro: FiltroPacientes,
    skip: number,
    take: number,
  ): Promise<{ items: PacienteData[]; total: number }> {
    const [rows, total] = await this.buildQuery(filtro)
      .offset(skip)
      .limit(take)
      .getManyAndCount();
    return { items: rows.map(toData), total };
  }

  private buildQuery(filtro: FiltroPacientes) {
    const query = this.pacientes
      .createQueryBuilder('paciente')
      .orderBy('paciente.apellido', 'ASC')
      .addOrderBy('paciente.nombre', 'ASC');
    if (filtro.term) {
      const pattern = `%${filtro.term.replace(/[\\%_]/g, '\\$&')}%`;
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
    if (filtro.tipoCobertura) {
      query.andWhere('paciente.tipoCobertura = :tipoCobertura', {
        tipoCobertura: filtro.tipoCobertura,
      });
    }
    return query;
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
      if (isUniqueViolation(error)) throw new DocumentoDuplicadoError();
      throw error;
    }
  }

  async update(
    id: string,
    changes: ActualizacionPaciente,
  ): Promise<PacienteData | null> {
    const entity = await this.pacientes.findOne({ where: { id } });
    if (!entity) return null;
    if (changes.nombre !== undefined) entity.nombre = changes.nombre;
    if (changes.apellido !== undefined) entity.apellido = changes.apellido;
    if (changes.documento !== undefined) entity.documento = changes.documento;
    if (changes.fechaNacimiento !== undefined) {
      entity.fechaNacimiento = changes.fechaNacimiento;
    }
    if (changes.telefono !== undefined) entity.telefono = changes.telefono;
    try {
      return toData(await this.pacientes.save(entity));
    } catch (error) {
      if (isUniqueViolation(error)) throw new DocumentoDuplicadoError();
      throw error;
    }
  }

  async updateCoverage(
    id: string,
    tipoCobertura: CoverageType,
    entidadCobertura: string | null,
  ): Promise<PacienteData | null> {
    const entity = await this.pacientes.findOne({ where: { id } });
    if (!entity) return null;
    entity.tipoCobertura = tipoCobertura;
    entity.entidadCobertura = entidadCobertura;
    return toData(await this.pacientes.save(entity));
  }
}