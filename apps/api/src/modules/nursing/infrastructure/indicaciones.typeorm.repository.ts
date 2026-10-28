import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, LessThanOrEqual, MoreThan, MoreThanOrEqual, Repository, type EntityManager } from 'typeorm';
import { AdministracionMedicacion } from '../../../entities/administracion-medicacion.entity.js';
import { IndicacionMedica } from '../../../entities/indicacion-medica.entity.js';
import { Insumo } from '../../../entities/insumo.entity.js';
import type {
  AdministracionData,
  ContextoAdministracion,
  IndicacionConAdministraciones,
  IndicacionData,
  IndicacionesRepository,
  NuevaAdministracion,
  NuevaIndicacion,
} from '../domain/ports/indicaciones.repository.js';

const RELACIONES = { paciente: true, medico: true, insumo: true } as const;

function toIndicacion(row: IndicacionMedica): IndicacionData {
  return {
    id: row.id,
    pacienteId: row.paciente.id,
    paciente: `${row.paciente.apellido}, ${row.paciente.nombre}`,
    medicoId: row.medico.id,
    insumoId: row.insumo.id,
    insumo: row.insumo.nombre,
    dosis: row.dosis,
    frecuencia: row.frecuencia,
    frecuenciaHoras: row.frecuenciaHoras ?? null,
    fechaInicio: new Date(row.fechaInicio),
    fechaFin: row.fechaFin ? new Date(row.fechaFin) : null,
  };
}

function toAdministracion(row: AdministracionMedicacion, indicacionId: string): AdministracionData {
  return {
    id: row.id,
    indicacionId,
    enfermeroId: row.enfermero.id,
    enfermero: `${row.enfermero.apellido}, ${row.enfermero.nombre}`,
    fechaHoraAdministracion: new Date(row.fechaHoraAdministracion),
    observaciones: row.observaciones ?? null,
  };
}

@Injectable()
export class IndicacionesTypeOrmRepository implements IndicacionesRepository {
  constructor(
    @InjectRepository(IndicacionMedica)
    private readonly indicaciones: Repository<IndicacionMedica>,
    @InjectRepository(AdministracionMedicacion)
    private readonly administraciones: Repository<AdministracionMedicacion>,
    @InjectRepository(Insumo)
    private readonly insumos: Repository<Insumo>,
    private readonly dataSource: DataSource,
  ) {}

  insumoExiste(insumoId: string): Promise<boolean> {
    return this.insumos.exists({ where: { id: insumoId } });
  }

  async create(data: NuevaIndicacion): Promise<IndicacionData> {
    const saved = await this.indicaciones.save(
      this.indicaciones.create({
        paciente: { id: data.pacienteId },
        medico: { id: data.medicoId },
        insumo: { id: data.insumoId },
        dosis: data.dosis,
        frecuencia: data.frecuencia,
        frecuenciaHoras: data.frecuenciaHoras,
        fechaFin: data.fechaFin as Date,
      }),
    );
    const row = await this.indicaciones.findOneOrFail({
      where: { id: saved.id },
      relations: RELACIONES,
    });
    return toIndicacion(row);
  }

  async listarActivas(
    pacienteId: string | undefined,
    ahora: Date,
    administracionesDesde: Date,
    limit: number,
  ): Promise<IndicacionConAdministraciones[]> {
    const base = {
      fechaInicio: LessThanOrEqual(ahora),
      ...(pacienteId ? { paciente: { id: pacienteId } } : {}),
    };
    const rows = await this.indicaciones.find({
      // Sin fin, o con fin posterior a ahora.
      where: [
        { ...base, fechaFin: IsNull() },
        { ...base, fechaFin: MoreThan(ahora) },
      ],
      relations: RELACIONES,
      order: { fechaInicio: 'DESC' },
      take: limit,
    });
    const resultado: IndicacionConAdministraciones[] = [];
    for (const row of rows) {
      const admins = await this.administraciones.find({
        where: {
          indicacion: { id: row.id },
          fechaHoraAdministracion: MoreThanOrEqual(administracionesDesde),
        },
        relations: { enfermero: true },
        order: { fechaHoraAdministracion: 'ASC' },
      });
      resultado.push({
        indicacion: toIndicacion(row),
        administraciones: admins.map((admin) => toAdministracion(admin, row.id)),
      });
    }
    return resultado;
  }

  administrarBajoBloqueo(
    indicacionId: string,
    decidir: (contexto: ContextoAdministracion) => NuevaAdministracion,
  ): Promise<{ indicacion: IndicacionData; administracion: AdministracionData }> {
    return this.dataSource.transaction(async (manager: EntityManager) => {
      // Bloqueo SOLO sobre la fila de la indicación: sin relations, porque PostgreSQL no admite
      // FOR UPDATE sobre el lado nullable de un LEFT JOIN (mismo bug que tuvimos en turnos).
      const locked = await manager.getRepository(IndicacionMedica).findOne({
        where: { id: indicacionId },
        lock: { mode: 'pessimistic_write', tables: ['indicaciones_medicas'] },
      });
      if (!locked) {
        decidir({ indicacion: null, administraciones: [] });
        throw new Error('decidir debe lanzar cuando la indicación no existe');
      }
      // Ya con la fila bloqueada, se leen los datos con sus relaciones (sin lock).
      const row = await manager.getRepository(IndicacionMedica).findOneOrFail({
        where: { id: indicacionId },
        relations: RELACIONES,
      });
      const indicacion = toIndicacion(row);
      const previas = await manager.getRepository(AdministracionMedicacion).find({
        where: { indicacion: { id: indicacionId } },
        relations: { enfermero: true },
        order: { fechaHoraAdministracion: 'ASC' },
      });

      const nueva = decidir({
        indicacion,
        administraciones: previas.map((admin) => toAdministracion(admin, indicacionId)),
      });

      const adminRepo = manager.getRepository(AdministracionMedicacion);
      const saved = await adminRepo.save(
        adminRepo.create({
          indicacion: { id: indicacionId },
          enfermero: { id: nueva.enfermeroId },
          fechaHoraAdministracion: nueva.fechaHoraAdministracion,
          observaciones: nueva.observaciones as string,
        }),
      );
      const completa = await adminRepo.findOneOrFail({
        where: { id: saved.id },
        relations: { enfermero: true },
      });
      return { indicacion, administracion: toAdministracion(completa, indicacionId) };
    });
  }
}
