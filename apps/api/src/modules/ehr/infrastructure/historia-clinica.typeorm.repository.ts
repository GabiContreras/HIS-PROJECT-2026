import { ConflictException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { RegistroClinico } from '../../../entities/registro-clinico.entity.js';
import { Turno, EstadoTurno } from '../../../entities/turno.entity.js';
import { Internacion } from '../../../entities/internacion.entity.js';
import { SignoVital } from '../../../entities/signo-vital.entity.js';
import { AdministracionMedicacion } from '../../../entities/administracion-medicacion.entity.js';
import { TipoIndicacion } from '../../../entities/indicacion-medica.entity.js';
import type {
  HistoriaClinicaRepository,
  NuevoRegistroClinico,
  RegistroClinicoData,
  TimelineEntry,
} from '../domain/ports/historia-clinica.repository.js';

function toData(row: RegistroClinico): RegistroClinicoData {
  return {
    id: row.id,
    categoria: row.categoria,
    titulo: row.titulo,
    detalle: row.detalle,
    registradoPor: `${row.registradoPor.apellido}, ${row.registradoPor.nombre}`,
    fechaHora: new Date(row.fechaHora),
    corrigeA: row.corrigeA?.id ?? null,
    rectificado: false,
    turnoId: row.turno?.id ?? null,
    internacionId: row.internacion?.id ?? null,
  };
}

@Injectable()
export class HistoriaClinicaTypeOrmRepository implements HistoriaClinicaRepository {
  constructor(
    @InjectRepository(RegistroClinico)
    private readonly registros: Repository<RegistroClinico>,
    @InjectRepository(Turno)
    private readonly turnos: Repository<Turno>,
    @InjectRepository(Internacion)
    private readonly internaciones: Repository<Internacion>,
    @InjectRepository(SignoVital)
    private readonly signos: Repository<SignoVital>,
    @InjectRepository(AdministracionMedicacion)
    private readonly administraciones: Repository<AdministracionMedicacion>,
  ) {}

  async create(data: NuevoRegistroClinico): Promise<RegistroClinicoData> {
    let saved: RegistroClinico;
    try {
      saved = await this.registros.save(
        this.registros.create({
          paciente: { id: data.pacienteId },
          registradoPor: { id: data.registradoPorId },
          categoria: data.categoria,
          titulo: data.titulo,
          detalle: data.detalle,
          corrigeA: data.corrigeA ? { id: data.corrigeA } : null,
          turno: data.turnoId ? { id: data.turnoId } : null,
          internacion: data.internacionId ? { id: data.internacionId } : null,
        }),
      );
    } catch (error) {
      if (
        error instanceof QueryFailedError &&
        (error as QueryFailedError & { driverError?: { constraint?: string } }).driverError?.constraint ===
          'uq_registros_clinicos_corrige_a'
      ) {
        throw new ConflictException('El registro clínico ya fue rectificado.');
      }
      throw error;
    }
    const row = await this.registros.findOneOrFail({
      where: { id: saved.id },
      relations: { registradoPor: true, corrigeA: true, turno: true, internacion: true },
    });
    return toData(row);
  }

  async listByPaciente(pacienteId: string): Promise<RegistroClinicoData[]> {
    const rows = await this.registros.find({
      where: { paciente: { id: pacienteId } },
      relations: { registradoPor: true, corrigeA: true, turno: true, internacion: true },
      order: { fechaHora: 'DESC' },
    });
    const corregidos = new Set(rows.flatMap((row) => row.corrigeA?.id ?? []));
    return rows.map((row) => ({ ...toData(row), rectificado: corregidos.has(row.id) }));
  }

  async getByPacienteAndId(pacienteId: string, registroId: string): Promise<RegistroClinicoData | null> {
    const row = await this.registros.findOne({
      where: { id: registroId, paciente: { id: pacienteId } },
      relations: { registradoPor: true, corrigeA: true, turno: true, internacion: true },
    });
    if (!row) return null;
    const correccion = await this.registros.exists({ where: { corrigeA: { id: registroId } } });
    return { ...toData(row), rectificado: correccion };
  }

  async timeline(pacienteId: string): Promise<TimelineEntry[]> {
    const [registros, internaciones, signos, administraciones, turnos] = await Promise.all([
      this.registros.find({ where: { paciente: { id: pacienteId } }, order: { fechaHora: 'DESC' } }),
      this.internaciones.find({ where: { pacienteId }, order: { fechaIngreso: 'DESC' } }),
      this.signos.find({
        where: { paciente: { id: pacienteId } },
        relations: { registradoPor: true },
        order: { fechaHora: 'DESC' },
        take: 200,
      }),
      this.administraciones.find({
        where: { indicacion: { paciente: { id: pacienteId }, tipo: TipoIndicacion.MEDICACION } },
        relations: { indicacion: true, enfermero: true },
        order: { fechaHoraAdministracion: 'DESC' },
        take: 200,
      }),
      this.turnos.find({
        where: { paciente: { id: pacienteId }, estado: EstadoTurno.ATENDIDO },
        order: { fechaHora: 'DESC' },
        take: 200,
      }),
    ]);

    return [
      ...registros.map((row): TimelineEntry => ({
        id: row.id,
        tipo: 'REGISTRO_CLINICO',
        fechaHora: row.fechaHora,
        titulo: row.titulo ?? row.categoria,
        detalle: row.detalle,
      })),
      ...internaciones.flatMap((row): TimelineEntry[] => [
        {
          id: `${row.id}:ingreso`,
          tipo: 'INTERNACION',
          fechaHora: row.fechaIngreso,
          titulo: 'Ingreso a internación',
          detalle: row.motivoIngreso ?? 'Sin motivo informado',
        },
        ...(row.fechaEgreso
          ? [{ id: `${row.id}:egreso`, tipo: 'INTERNACION' as const, fechaHora: row.fechaEgreso, titulo: 'Egreso de internación', detalle: 'Internación finalizada' }]
          : []),
      ]),
      ...signos.map((row): TimelineEntry => ({
        id: row.id,
        tipo: 'SIGNO_VITAL',
        fechaHora: row.fechaHora,
        titulo: row.tipo,
        detalle: `${row.valor}`,
      })),
      ...administraciones
        .filter((row) => row.resultado === 'ADMINISTRADA')
        .map((row): TimelineEntry => ({
          id: row.id,
          tipo: 'MEDICACION',
          fechaHora: row.fechaHoraAdministracion,
          titulo: row.indicacion.dosis,
          detalle: `${row.enfermero.apellido}, ${row.enfermero.nombre}`,
        })),
      ...turnos.map((row): TimelineEntry => ({
        id: row.id,
        tipo: 'TURNO',
        fechaHora: row.fechaHora,
        titulo: 'Turno atendido',
        detalle: row.urgente ? 'Atención urgente' : 'Atención programada',
      })),
    ].sort((a, b) => b.fechaHora.getTime() - a.fechaHora.getTime());
  }

  async validarContexto(pacienteId: string, turnoId?: string, internacionId?: string): Promise<boolean> {
    const [turno, internacion] = await Promise.all([
      turnoId ? this.turnos.exists({ where: { id: turnoId, paciente: { id: pacienteId } } }) : true,
      internacionId ? this.internaciones.exists({ where: { id: internacionId, pacienteId } }) : true,
    ]);
    return turno && internacion;
  }
}
