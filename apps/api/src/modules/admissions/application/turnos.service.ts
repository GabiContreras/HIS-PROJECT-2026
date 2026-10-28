import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { Paciente } from '../../../entities/paciente.entity.js';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { EstadoTurno, Turno } from '../../../entities/turno.entity.js';
import { SessionIdentity } from '../../iam/application/auth.service.js';
import { CrearTurnoDto } from '../api/dto/crear-turno.dto.js';
import { ReservarTurnoDto } from '../api/dto/reservar-turno.dto.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';

const STANDARD_DURATION_MINUTES = 30;
const URGENT_DURATION_MINUTES = 15;
const MINIMUM_DURATION_MINUTES = 15;
const ADJACENT_SLOT_OFFSET_MS = URGENT_DURATION_MINUTES * 60_000;

export interface TurnoSummary {
  id: string;
  fechaHora: Date;
  duracionMinutos: number;
  estado: EstadoTurno;
  urgente: boolean;
  medico: { id: string; nombre: string; apellido: string };
}

export interface TurnoAgendaSummary extends TurnoSummary {
  paciente: { id: string; nombre: string; apellido: string } | null;
}

@Injectable()
export class TurnosService {
  constructor(
    @InjectRepository(Turno)
    private readonly turnos: Repository<Turno>,
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(Paciente)
    private readonly pacientes: Repository<Paciente>,
    private readonly dataSource: DataSource,
    private readonly events: EventBus,
  ) {}

  async listAvailable(
    medicoId?: string,
    desde?: string,
    hasta?: string,
  ): Promise<TurnoSummary[]> {
    this.validateDateRange(desde, hasta);
    const query = this.turnos
      .createQueryBuilder('turno')
      .innerJoin('turno.medico', 'medico')
      .select([
        'turno.id',
        'turno.fechaHora',
        'turno.duracionMinutos',
        'turno.estado',
        'turno.urgente',
        'medico.id',
        'medico.nombre',
        'medico.apellido',
      ])
      .where('turno.estado = :estado', { estado: EstadoTurno.DISPONIBLE })
      .andWhere('turno.fechaHora >= :now', { now: new Date() })
      .orderBy('turno.fechaHora', 'ASC');
    if (medicoId) query.andWhere('medico.id = :medicoId', { medicoId });
    if (desde) query.andWhere('turno.fechaHora >= :desde', { desde });
    if (hasta) query.andWhere('turno.fechaHora < :hasta', { hasta });
    const rows = await query.getMany();
    return rows.map((turno) => this.toSummary(turno));
  }

  async listAgenda(
    filters: { medicoId?: string; desde?: string; hasta?: string },
    identity: SessionIdentity,
  ): Promise<TurnoAgendaSummary[]> {
    this.validateDateRange(filters.desde, filters.hasta);
    const doctorId =
      identity.rol === RolUsuario.MEDICO
        ? identity.accountId
        : filters.medicoId;
    if (
      identity.rol === RolUsuario.MEDICO &&
      filters.medicoId &&
      filters.medicoId !== identity.accountId
    ) {
      throw new ForbiddenException('Solo podés consultar tu propia agenda.');
    }
    const query = this.turnos
      .createQueryBuilder('turno')
      .innerJoin('turno.medico', 'medico')
      .leftJoin('turno.paciente', 'paciente')
      .select([
        'turno.id',
        'turno.fechaHora',
        'turno.duracionMinutos',
        'turno.estado',
        'turno.urgente',
        'medico.id',
        'medico.nombre',
        'medico.apellido',
        'paciente.id',
        'paciente.nombre',
        'paciente.apellido',
      ])
      .orderBy('turno.fechaHora', 'ASC');
    if (doctorId) query.andWhere('medico.id = :doctorId', { doctorId });
    if (filters.desde) {
      query.andWhere('turno.fechaHora >= :desde', { desde: filters.desde });
    }
    if (filters.hasta) {
      query.andWhere('turno.fechaHora < :hasta', { hasta: filters.hasta });
    }
    const rows = await query.getMany();
    return rows.map((turno) => ({
      ...this.toSummary(turno),
      paciente: turno.paciente
        ? {
            id: turno.paciente.id,
            nombre: turno.paciente.nombre,
            apellido: turno.paciente.apellido,
          }
        : null,
    }));
  }

  async createSlot(
    dto: CrearTurnoDto,
    identity: SessionIdentity,
  ): Promise<TurnoSummary> {
    const start = this.parseFutureDate(dto.fechaHora);
    if (
      start.getUTCMinutes() % 30 !== 0 ||
      start.getUTCSeconds() !== 0 ||
      start.getUTCMilliseconds() !== 0
    ) {
      throw new BadRequestException(
        'Los turnos regulares deben comenzar cada 30 minutos.',
      );
    }
    this.assertCanManageDoctor(identity, dto.medicoId);
    return this.dataSource.transaction(async (manager) => {
      const doctor = await this.lockDoctor(manager, dto.medicoId);
      const repository = manager.getRepository(Turno);
      if (
        await this.hasOverlap(
          repository,
          dto.medicoId,
          start,
          STANDARD_DURATION_MINUTES,
        )
      ) {
        throw new ConflictException('El horario se superpone con otro turno.');
      }
      const turno = repository.create({
        medico: doctor,
        fechaHora: start,
        duracionMinutos: STANDARD_DURATION_MINUTES,
        estado: EstadoTurno.DISPONIBLE,
        urgente: false,
      });
      return this.toSummary(await repository.save(turno));
    });
  }

  async createUrgentSlot(
    dto: CrearTurnoDto,
    identity: SessionIdentity,
  ): Promise<TurnoSummary> {
    const urgentStart = this.parseFutureDate(dto.fechaHora);
    if (
      urgentStart.getUTCMinutes() % 30 !== 15 ||
      urgentStart.getUTCSeconds() !== 0 ||
      urgentStart.getUTCMilliseconds() !== 0
    ) {
      throw new BadRequestException(
        'Los turnos de urgencia deben comenzar en un límite de 15 minutos.',
      );
    }
    this.assertCanManageDoctor(identity, dto.medicoId);
    return this.dataSource.transaction(async (manager) => {
      const doctor = await this.lockDoctor(manager, dto.medicoId);
      const repository = manager.getRepository(Turno);
      const adjacentStart = new Date(
        urgentStart.getTime() - ADJACENT_SLOT_OFFSET_MS,
      );
      const adjacent = await repository.findOne({
        where: {
          fechaHora: adjacentStart,
          duracionMinutos: STANDARD_DURATION_MINUTES,
          estado: EstadoTurno.DISPONIBLE,
          urgente: false,
          medico: { id: dto.medicoId },
        },
        lock: { mode: 'pessimistic_write' },
      });
      if (
        !adjacent ||
        adjacent.duracionMinutos - URGENT_DURATION_MINUTES <
          MINIMUM_DURATION_MINUTES
      ) {
        throw new ConflictException(
          'No hay un turno disponible adyacente que pueda ajustarse.',
        );
      }
      if (
        await this.hasOverlap(
          repository,
          dto.medicoId,
          urgentStart,
          URGENT_DURATION_MINUTES,
          adjacent.id,
        )
      ) {
        throw new ConflictException(
          'El horario de urgencia no está disponible.',
        );
      }

      adjacent.duracionMinutos -= URGENT_DURATION_MINUTES;
      await repository.save(adjacent);
      const urgent = repository.create({
        medico: doctor,
        fechaHora: urgentStart,
        duracionMinutos: URGENT_DURATION_MINUTES,
        estado: EstadoTurno.DISPONIBLE,
        urgente: true,
      });
      return this.toSummary(await repository.save(urgent));
    });
  }

  async reserve(
    id: string,
    dto: ReservarTurnoDto,
    identity: SessionIdentity,
  ): Promise<TurnoSummary> {
    return this.dataSource.transaction(async (manager) => {
      const initial = await manager.getRepository(Turno).findOne({
        where: { id },
        relations: { medico: true },
      });
      if (!initial) throw new NotFoundException('No se encontró el turno.');
      this.assertCanManageDoctor(identity, initial.medico.id);
      await this.lockDoctor(manager, initial.medico.id);

      const turnosRepo = manager.getRepository(Turno);
      const turno = await turnosRepo.findOne({
        where: { id },
        relations: { medico: true },
        lock: { mode: 'pessimistic_write', tables: ['turnos'] },
      });
      if (!turno) throw new NotFoundException('No se encontró el turno.');
      if (
        turno.estado !== EstadoTurno.DISPONIBLE ||
        turno.fechaHora <= new Date()
      ) {
        throw new ConflictException('El turno ya no está disponible.');
      }

      const patient = await manager.getRepository(Paciente).findOne({
        where: { id: dto.pacienteId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!patient) throw new NotFoundException('No se encontró el paciente.');

      if (
        await this.hasOverlap(
          turnosRepo,
          turno.medico.id,
          turno.fechaHora,
          turno.duracionMinutos,
          turno.id,
          [EstadoTurno.RESERVADO, EstadoTurno.CONFIRMADO],
        )
      ) {
        throw new ConflictException(
          'El médico tiene otro turno reservado en ese horario.',
        );
      }
      if (
        await this.patientHasOverlap(
          turnosRepo,
          patient.id,
          turno.fechaHora,
          turno.duracionMinutos,
          turno.id,
        )
      ) {
        throw new ConflictException(
          'El paciente ya tiene un turno reservado en ese horario.',
        );
      }

      turno.paciente = patient;
      turno.estado = EstadoTurno.RESERVADO;
      return this.toSummary(await turnosRepo.save(turno));
    });
  }

  async transition(
    id: string,
    nextState: EstadoTurno,
    identity: SessionIdentity,
  ): Promise<TurnoSummary> {
    const result = await this.dataSource.transaction(async (manager) => {
      const initial = await manager.getRepository(Turno).findOne({
        where: { id },
        relations: { medico: true },
      });
      if (!initial) throw new NotFoundException('No se encontró el turno.');
      this.assertCanManageDoctor(identity, initial.medico.id);
      await this.lockDoctor(manager, initial.medico.id);

      const repository = manager.getRepository(Turno);
      const turno = await repository.findOne({
        where: { id },
        relations: { medico: true },
        lock: { mode: 'pessimistic_write', tables: ['turnos'] },
      });
      if (!turno) throw new NotFoundException('No se encontró el turno.');
      const allowedTransitions: Partial<Record<EstadoTurno, EstadoTurno[]>> = {
        [EstadoTurno.RESERVADO]: [
          EstadoTurno.CONFIRMADO,
          EstadoTurno.CANCELADO,
        ],
        [EstadoTurno.CONFIRMADO]: [EstadoTurno.CANCELADO, EstadoTurno.ATENDIDO],
      };
      if (!allowedTransitions[turno.estado]?.includes(nextState)) {
        throw new ConflictException(
          `No se permite pasar de ${turno.estado} a ${nextState}.`,
        );
      }
      turno.estado = nextState;
      const saved = await repository.save(turno);
      if (nextState === EstadoTurno.CANCELADO) {
        await repository.save(
          repository.create({
            medico: turno.medico,
            fechaHora: turno.fechaHora,
            duracionMinutos: turno.duracionMinutos,
            urgente: turno.urgente,
            estado: EstadoTurno.DISPONIBLE,
          }),
        );
      }
      return {
        summary: this.toSummary(saved),
        appointmentAttended:
          nextState === EstadoTurno.ATENDIDO
            ? { appointmentId: saved.id, urgente: saved.urgente }
            : undefined,
      };
    });
    if (result.appointmentAttended) {
      this.events.publish({
        type: 'admissions.appointment-attended',
        occurredAt: new Date().toISOString(),
        payload: result.appointmentAttended,
      });
    }
    return result.summary;
  }

  private async lockDoctor(
    manager: EntityManager,
    doctorId: string,
  ): Promise<Usuario> {
    const doctor = await manager.getRepository(Usuario).findOne({
      where: { id: doctorId },
      lock: { mode: 'pessimistic_write' },
    });
    if (
      !doctor ||
      doctor.rol !== RolUsuario.MEDICO ||
      doctor.estado !== EstadoCuenta.ACTIVO
    ) {
      throw new NotFoundException('No se encontró un médico activo.');
    }
    return doctor;
  }

  private async hasOverlap(
    repository: Repository<Turno>,
    doctorId: string,
    start: Date,
    durationMinutes: number,
    exceptId?: string,
    states?: EstadoTurno[],
  ): Promise<boolean> {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const query = repository
      .createQueryBuilder('turno')
      .innerJoin('turno.medico', 'medico')
      .where('medico.id = :doctorId', { doctorId })
      .andWhere(`turno.fechaHora < :end`, { end })
      .andWhere(
        `turno.fechaHora + turno.duracionMinutos * INTERVAL '1 minute' > :start`,
        { start },
      )
      .andWhere('turno.estado != :cancelled', {
        cancelled: EstadoTurno.CANCELADO,
      });
    if (exceptId) query.andWhere('turno.id != :exceptId', { exceptId });
    if (states) query.andWhere('turno.estado IN (:...states)', { states });
    return (await query.getCount()) > 0;
  }

  private async patientHasOverlap(
    repository: Repository<Turno>,
    patientId: string,
    start: Date,
    durationMinutes: number,
    exceptId: string,
  ): Promise<boolean> {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return (
      (await repository
        .createQueryBuilder('turno')
        .innerJoin('turno.paciente', 'paciente')
        .where('paciente.id = :patientId', { patientId })
        .andWhere('turno.id != :exceptId', { exceptId })
        .andWhere('turno.estado IN (:...states)', {
          states: [EstadoTurno.RESERVADO, EstadoTurno.CONFIRMADO],
        })
        .andWhere('turno.fechaHora < :end', { end })
        .andWhere(
          `turno.fechaHora + turno.duracionMinutos * INTERVAL '1 minute' > :start`,
          { start },
        )
        .getCount()) > 0
    );
  }

  private parseFutureDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime()) || date <= new Date()) {
      throw new BadRequestException(
        'La fecha del turno debe ser futura y válida.',
      );
    }
    return date;
  }

  private validateDateRange(desde?: string, hasta?: string): void {
    const start = desde ? new Date(desde) : undefined;
    const end = hasta ? new Date(hasta) : undefined;
    if (
      (start && Number.isNaN(start.getTime())) ||
      (end && Number.isNaN(end.getTime())) ||
      (start && end && end <= start)
    ) {
      throw new BadRequestException(
        'El rango debe ser válido y el fin posterior al inicio.',
      );
    }
  }

  private assertCanManageDoctor(
    identity: SessionIdentity,
    doctorId: string,
  ): void {
    if (identity.rol === RolUsuario.MEDICO && identity.accountId !== doctorId) {
      throw new ForbiddenException('Solo podés gestionar tu propia agenda.');
    }
  }

  private toSummary(turno: Turno): TurnoSummary {
    return {
      id: turno.id,
      fechaHora: turno.fechaHora,
      duracionMinutos: turno.duracionMinutos,
      estado: turno.estado,
      urgente: turno.urgente,
      medico: {
        id: turno.medico.id,
        nombre: turno.medico.nombre,
        apellido: turno.medico.apellido,
      },
    };
  }
}
