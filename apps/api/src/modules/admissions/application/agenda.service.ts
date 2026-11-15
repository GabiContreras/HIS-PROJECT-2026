import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import {
  AgendaExcepcion,
  TipoExcepcion,
} from '../../../entities/agenda-excepcion.entity.js';
import { AgendaMedico } from '../../../entities/agenda-medico.entity.js';
import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { type BloqueAgenda, validarBloques } from '../domain/agenda.rules.js';

export interface AgendaCargada {
  bloques: Map<string, BloqueAgenda[]>;
  bloqueadas: Map<string, Set<string>>;
}

function toBloque(row: AgendaMedico): BloqueAgenda {
  return {
    diaSemana: row.diaSemana,
    horaInicio: row.horaInicio.slice(0, 5),
    horaFin: row.horaFin.slice(0, 5),
  };
}

function isUniqueViolation(error: unknown): boolean {
  const e = error as { code?: string; driverError?: { code?: string } };
  return e?.code === '23505' || e?.driverError?.code === '23505';
}

@Injectable()
export class AgendaService {
  constructor(
    @InjectRepository(AgendaMedico)
    private readonly bloques: Repository<AgendaMedico>,
    @InjectRepository(AgendaExcepcion)
    private readonly excepciones: Repository<AgendaExcepcion>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    private readonly dataSource: DataSource,
  ) {}

  async obtener(medicoId: string): Promise<BloqueAgenda[]> {
    await this.assertMedico(medicoId);
    const rows = await this.bloques.find({
      where: { medicoId },
      order: { diaSemana: 'ASC', horaInicio: 'ASC' },
    });
    return rows.map(toBloque);
  }

  async reemplazar(
    medicoId: string,
    input: BloqueAgenda[],
  ): Promise<BloqueAgenda[]> {
    await this.assertMedico(medicoId);
    const problema = validarBloques(input);
    if (problema) throw new BadRequestException(problema);
    await this.dataSource.transaction(async (manager) => {
      const repository = manager.getRepository(AgendaMedico);
      await repository.delete({ medicoId });
      if (input.length > 0) {
        await repository.insert(
          input.map((bloque) => ({
            medicoId,
            diaSemana: bloque.diaSemana,
            horaInicio: bloque.horaInicio,
            horaFin: bloque.horaFin,
          })),
        );
      }
    });
    return this.obtener(medicoId);
  }

  listarExcepciones(medicoId?: string): Promise<AgendaExcepcion[]> {
    return this.excepciones.find({
      where: medicoId
        ? [{ medicoId }, { medicoId: IsNull() }]
        : {},
      order: { fecha: 'ASC' },
    });
  }

  async crearExcepcion(input: {
    fecha: string;
    tipo: TipoExcepcion;
    medicoId?: string;
    motivo?: string;
  }): Promise<AgendaExcepcion> {
    if (input.medicoId) await this.assertMedico(input.medicoId);
    try {
      return await this.excepciones.save(
        this.excepciones.create({
          medicoId: input.medicoId ?? null,
          fecha: input.fecha,
          tipo: input.tipo,
          motivo: input.motivo ?? null,
        }),
      );
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una excepción para esa fecha.');
      }
      throw error;
    }
  }

  async eliminarExcepcion(id: string): Promise<void> {
    const result = await this.excepciones.delete({ id });
    if (!result.affected) {
      throw new NotFoundException('No se encontró la excepción.');
    }
  }

  async cargarParaDisponibilidad(
    medicoIds: string[],
    desde: string,
    hasta: string,
  ): Promise<AgendaCargada> {
    const bloques = new Map<string, BloqueAgenda[]>();
    const bloqueadas = new Map<string, Set<string>>();
    for (const id of medicoIds) {
      bloques.set(id, []);
      bloqueadas.set(id, new Set());
    }
    if (medicoIds.length === 0) return { bloques, bloqueadas };

    const rows = await this.bloques
      .createQueryBuilder('b')
      .where('b.medicoId IN (:...ids)', { ids: medicoIds })
      .getMany();
    for (const row of rows) bloques.get(row.medicoId)?.push(toBloque(row));

    const excepciones = await this.excepciones
      .createQueryBuilder('e')
      .where('e.fecha BETWEEN :desde AND :hasta', { desde, hasta })
      .andWhere('(e.medicoId IS NULL OR e.medicoId IN (:...ids))', {
        ids: medicoIds,
      })
      .getMany();
    for (const excepcion of excepciones) {
      const targets = excepcion.medicoId ? [excepcion.medicoId] : medicoIds;
      for (const id of targets) bloqueadas.get(id)?.add(excepcion.fecha);
    }
    return { bloques, bloqueadas };
  }

  private async assertMedico(medicoId: string): Promise<void> {
    const medico = await this.usuarios.findOneBy({ id: medicoId });
    if (!medico || medico.rol !== RolUsuario.MEDICO) {
      throw new NotFoundException('No se encontró un médico.');
    }
  }
}