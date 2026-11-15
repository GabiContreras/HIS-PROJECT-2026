import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Especialidad } from '../../../entities/especialidad.entity.js';
import { MedicoEspecialidad } from '../../../entities/medico-especialidad.entity.js';
import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}

@Injectable()
export class EspecialidadesService {
  constructor(
    @InjectRepository(Especialidad)
    private readonly especialidades: Repository<Especialidad>,
    @InjectRepository(MedicoEspecialidad)
    private readonly asignaciones: Repository<MedicoEspecialidad>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  list(): Promise<Especialidad[]> {
    return this.especialidades.find({ order: { nombre: 'ASC' } });
  }

  async create(nombre: string): Promise<Especialidad> {
    try {
      return await this.especialidades.save(
        this.especialidades.create({ nombre: nombre.trim() }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una especialidad con ese nombre.');
      }
      throw error;
    }
  }

  async remove(id: string): Promise<void> {
    const asignadas = await this.asignaciones.count({
      where: { especialidadId: id },
    });
    if (asignadas > 0) {
      throw new ConflictException(
        'La especialidad está asignada a médicos. Quitala de sus perfiles antes de eliminarla.',
      );
    }
    const result = await this.especialidades.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('No se encontró la especialidad.');
    }
  }

  async delMedico(medicoId: string): Promise<Especialidad[]> {
    await this.assertMedico(medicoId);
    const rows = await this.asignaciones.find({ where: { medicoId } });
    if (rows.length === 0) return [];
    return this.especialidades.find({
      where: { id: In(rows.map((row) => row.especialidadId)) },
      order: { nombre: 'ASC' },
    });
  }

  async asignar(
    medicoId: string,
    especialidadIds: string[],
  ): Promise<Especialidad[]> {
    await this.assertMedico(medicoId);
    const unique = [...new Set(especialidadIds)];
    if (unique.length > 0) {
      const found = await this.especialidades.count({
        where: { id: In(unique) },
      });
      if (found !== unique.length) {
        throw new BadRequestException('Alguna de las especialidades no existe.');
      }
    }
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(MedicoEspecialidad);
      await repository.delete({ medicoId });
      if (unique.length > 0) {
        await repository.insert(
          unique.map((especialidadId) => ({ medicoId, especialidadId })),
        );
      }
    });
    return this.delMedico(medicoId);
  }

  async medicoIds(especialidadId: string): Promise<string[]> {
    const rows = await this.asignaciones.find({ where: { especialidadId } });
    return rows.map((row) => row.medicoId);
  }

  private async assertMedico(medicoId: string): Promise<void> {
    const medico = await this.usuarios.findOneBy({ id: medicoId });
    if (!medico || medico.rol !== RolUsuario.MEDICO) {
      throw new NotFoundException('No se encontró un médico.');
    }
  }
}