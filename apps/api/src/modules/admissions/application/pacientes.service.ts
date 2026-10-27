import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Brackets, QueryFailedError, Repository } from 'typeorm';
import { Paciente } from '../../../entities/paciente.entity.js';
import type { CrearPacienteDto } from '../api/dto/crear-paciente.dto.js';

const SEARCH_LIMIT = 50;
const MIN_BIRTH_DATE = '1900-01-01';
const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION
  );
}

@Injectable()
export class PacientesService {
  constructor(
    @InjectRepository(Paciente)
    private readonly pacientes: Repository<Paciente>,
  ) {}

  async search(term?: string): Promise<Paciente[]> {
    const query = this.pacientes
      .createQueryBuilder('paciente')
      .orderBy('paciente.apellido', 'ASC')
      .addOrderBy('paciente.nombre', 'ASC')
      .limit(SEARCH_LIMIT);

    const text = term?.trim();
    if (text) {
      // Escapa los comodines de LIKE para que "%" o "_" se busquen como texto.
      const pattern = `%${text.replace(/[\\%_]/g, '\\$&')}%`;
      query.andWhere(
        new Brackets((qb) => {
          qb.where("CONCAT(paciente.nombre, ' ', paciente.apellido) ILIKE :pattern", { pattern })
            .orWhere("CONCAT(paciente.apellido, ' ', paciente.nombre) ILIKE :pattern", { pattern })
            .orWhere('paciente.documento ILIKE :pattern', { pattern });
        }),
      );
    }
    return query.getMany();
  }

  async get(id: string): Promise<Paciente> {
    const paciente = await this.pacientes.findOne({ where: { id } });
    if (!paciente) throw new NotFoundException('No se encontró el paciente.');
    return paciente;
  }

  async create(dto: CrearPacienteDto): Promise<Paciente> {
    const birth = dto.fechaNacimiento.slice(0, 10);
    const today = new Date().toISOString().slice(0, 10);
    if (birth > today) {
      throw new BadRequestException(
        'La fecha de nacimiento no puede ser futura.',
      );
    }
    if (birth < MIN_BIRTH_DATE) {
      throw new BadRequestException('La fecha de nacimiento no es válida.');
    }

    const duplicated = await this.pacientes.findOne({
      where: { documento: dto.documento },
    });
    if (duplicated) {
      throw new ConflictException('Ya existe un paciente con ese documento.');
    }

    try {
      return await this.pacientes.save(
        this.pacientes.create({
          nombre: dto.nombre,
          apellido: dto.apellido,
          documento: dto.documento,
          fechaNacimiento: birth,
          telefono: dto.telefono,
        }),
      );
    } catch (error) {
      // Dos altas simultáneas con el mismo documento: gana una, la otra recibe 409.
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un paciente con ese documento.');
      }
      throw error;
    }
  }
}