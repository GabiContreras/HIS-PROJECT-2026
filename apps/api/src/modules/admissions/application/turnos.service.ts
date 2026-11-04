import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { EntreturnoStandby, EstadoStandby } from '../../../entities/entreturno-standby.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { EstadoTurno, Turno } from '../../../entities/turno.entity.js';
import { SessionIdentity } from '../../iam/application/auth.service.js';
import { ReservarTurnoDto } from '../api/dto/reservar-turno.dto.js';
import { clinicDateOf } from './clinic-time.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import {
  tablaTransiciones,
  turnoStateFor,
} from '../domain/states/turno-states.js';
import { TransicionTurnoInvalidaError } from '../domain/states/turno-state.interface.js';

const STANDARD_DURATION_MINUTES = 30;
const URGENT_DURATION_MINUTES = 15;
const SLOT_MS = STANDARD_DURATION_MINUTES * 60_000;
const DAY_MS = 24 * 60 * 60_000;
const DEFAULT_AVAILABILITY_DAYS = 7;
const MAX_AVAILABILITY_DAYS = 31;

// Horario general de la clínica: 08:00 a 20:00 (hora de Argentina). Cada médico
// atiende dentro de su propio horario (usuarios.horaInicio/horaFin), que nunca
// puede salir de ese rango. La disponibilidad se calcula, no se carga a mano.
const CLINIC_TIME_ZONE = 'America/Argentina/Buenos_Aires';

/** Estados que no ocupan agenda: los cancelados y las franjas libres heredadas. */
const NON_OCCUPYING_STATES = [EstadoTurno.CANCELADO, EstadoTurno.DISPONIBLE];
/** Estados en los que un paciente "tiene" el turno (para evitar dobles reservas). */
const PATIENT_ACTIVE_STATES = [
  EstadoTurno.RESERVADO,
  EstadoTurno.CONFIRMADO,
  EstadoTurno.EN_SALA_DE_ESPERA,
];

const clinicClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: CLINIC_TIME_ZONE,
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** Minutos transcurridos desde la medianoche, en la hora local de la clínica. */
function clinicMinutesOfDay(date: Date): number {
  const parts = clinicClock.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value);
  return hour * 60 + minute;
}

/** 'HH:MM' o 'HH:MM:SS' → minutos desde la medianoche. */
function scheduleMinutes(time: string): number {
  const [hour, minute] = time.split(':').map(Number);
  return hour * 60 + minute;
}

/** Paciente de la lista de espera al que se le asignó el horario liberado (HU 1.3). */
export interface PromocionStandby {
  turno: TurnoSummary;
  paciente: { id: string; nombre: string; apellido: string };
}

export interface SlotDisponible {
  fechaHora: Date;
  /** 30, o 15 si un entreturno ocupa la segunda mitad del horario. */
  duracionMinutos: number;
  medico: { id: string; nombre: string; apellido: string };
}

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

  /**
   * Horarios libres calculados: grilla de 30 min dentro del horario de cada
   * médico activo, menos lo ocupado. No incluye entreturnos (se insertan sobre
   * un horario libre de 30 min, a los :15 o :45).
   */
  async listAvailable(
    medicoId?: string,
    desde?: string,
    hasta?: string,
  ): Promise<SlotDisponible[]> {
    this.validateDateRange(desde, hasta);
    const now = Date.now();
    const requestedStart = desde ? new Date(desde).getTime() : now;
    const from = Math.ceil(Math.max(requestedStart, now) / SLOT_MS) * SLOT_MS;
    const to = hasta
      ? new Date(hasta).getTime()
      : from + DEFAULT_AVAILABILITY_DAYS * DAY_MS;
    if (to - from > MAX_AVAILABILITY_DAYS * DAY_MS) {
      throw new BadRequestException(
        `El rango no puede superar ${MAX_AVAILABILITY_DAYS} días.`,
      );
    }
    if (to <= from) return [];

    const doctors = await this.usuarios.find({
      where: {
        rol: RolUsuario.MEDICO,
        estado: EstadoCuenta.ACTIVO,
        ...(medicoId ? { id: medicoId } : {}),
      },
      order: { apellido: 'ASC', nombre: 'ASC' },
    });
    if (doctors.length === 0) return [];

    const occupiedRows = await this.turnos
      .createQueryBuilder('turno')
      .innerJoin('turno.medico', 'medico')
      .select([
        'turno.fechaHora',
        'turno.duracionMinutos',
        'medico.id',
      ])
      .where('medico.id IN (:...ids)', { ids: doctors.map((d) => d.id) })
      .andWhere('turno.estado NOT IN (:...inactive)', {
        inactive: NON_OCCUPYING_STATES,
      })
      .andWhere('turno.fechaHora < :end', { end: new Date(to) })
      .andWhere(
        `turno.fechaHora + turno.duracionMinutos * INTERVAL '1 minute' > :start`,
        { start: new Date(from) },
      )
      .getMany();
    const occupiedByDoctor = new Map<string, Array<[number, number]>>();
    for (const row of occupiedRows) {
      const begin = row.fechaHora.getTime();
      const list = occupiedByDoctor.get(row.medico.id) ?? [];
      list.push([begin, begin + row.duracionMinutos * 60_000]);
      occupiedByDoctor.set(row.medico.id, list);
    }

    const slots: SlotDisponible[] = [];
    for (let time = from; time < to; time += SLOT_MS) {
      const minutes = clinicMinutesOfDay(new Date(time));
      for (const doctor of doctors) {
        if (
          minutes < scheduleMinutes(doctor.horaInicio) ||
          minutes + STANDARD_DURATION_MINUTES > scheduleMinutes(doctor.horaFin)
        ) {
          continue;
        }
        const occupied = occupiedByDoctor.get(doctor.id) ?? [];
        const half = time + URGENT_DURATION_MINUTES * 60_000;
        const overlaps = (start: number, end: number) =>
          occupied.some(([b, e]) => b < end && e > start);
        if (overlaps(time, half)) continue;
        slots.push({
          fechaHora: new Date(time),
          duracionMinutos: overlaps(half, time + SLOT_MS)
            ? URGENT_DURATION_MINUTES
            : STANDARD_DURATION_MINUTES,
          medico: {
            id: doctor.id,
            nombre: doctor.nombre,
            apellido: doctor.apellido,
          },
        });
      }
    }
    return slots;
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

  /** HU 1.1: reserva de un horario libre. Lock del médico + índice único. */
  async reserve(
    dto: ReservarTurnoDto,
    identity: SessionIdentity,
  ): Promise<TurnoSummary> {
    const start = this.parseDate(dto.fechaHora);
    if (!this.isAligned(start, 0)) {
      throw new BadRequestException(
        'Los turnos regulares deben comenzar cada 30 minutos.',
      );
    }
    this.assertCanManageDoctor(identity, dto.medicoId);
    return this.dataSource.transaction(async (manager) => {
      const doctor = await this.lockDoctor(manager, dto.medicoId);
      this.assertNotPast(start);
      this.assertWithinSchedule(doctor, start);
      const repository = manager.getRepository(Turno);
      if (
        await this.hasOverlap(
          repository,
          doctor.id,
          start,
          URGENT_DURATION_MINUTES,
        )
      ) {
        throw new ConflictException(
          'Este turno acaba de ser ocupado. Elegí otro horario.',
        );
      }
      // Si un entreturno ya ocupa la segunda mitad, el turno queda en 15 min (HU 1.2).
      const secondHalf = new Date(start.getTime() + URGENT_DURATION_MINUTES * 60_000);
      const duration = (await this.hasOverlap(
        repository,
        doctor.id,
        secondHalf,
        URGENT_DURATION_MINUTES,
      ))
        ? URGENT_DURATION_MINUTES
        : STANDARD_DURATION_MINUTES;
      return this.createReservation(manager, doctor, dto.pacienteId, start, duration, false);
    });
  }

  /**
   * HU 1.2: entreturno de 15 min a los :15/:45 dentro de un horario libre de 30 min.
   * El horario adyacente queda en 15 min (se deriva solo, no se modifica ninguna fila).
   */
  async reserveUrgent(
    dto: ReservarTurnoDto,
    identity: SessionIdentity,
  ): Promise<TurnoSummary> {
    const start = this.parseDate(dto.fechaHora);
    if (!this.isAligned(start, 15)) {
      throw new BadRequestException(
        'Los entreturnos deben comenzar a los :15 o :45.',
      );
    }
    this.assertCanManageDoctor(identity, dto.medicoId);
    return this.dataSource.transaction(async (manager) => {
      const doctor = await this.lockDoctor(manager, dto.medicoId);
      this.assertNotPast(start);
      const slotStart = new Date(start.getTime() - URGENT_DURATION_MINUTES * 60_000);
      this.assertWithinSchedule(doctor, slotStart);
      const repository = manager.getRepository(Turno);
      if (
        await this.hasOverlap(
          repository,
          doctor.id,
          slotStart,
          STANDARD_DURATION_MINUTES,
        )
      ) {
        throw new ConflictException(
          'No hay un turno disponible adyacente que pueda ajustarse.',
        );
      }
      return this.createReservation(
        manager,
        doctor,
        dto.pacienteId,
        start,
        URGENT_DURATION_MINUTES,
        true,
      );
    });
  }

  /** HU 2.1: transiciones del flujo de atención según el Patrón State. */
  async transition(
    id: string,
    nextState: EstadoTurno,
    identity: SessionIdentity,
  ): Promise<TurnoSummary & { promovido: PromocionStandby | null }> {
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
        relations: { medico: true, paciente: true },
        lock: { mode: 'pessimistic_write', tables: ['turnos'] },
      });
      if (!turno) throw new NotFoundException('No se encontró el turno.');
      try {
        turno.estado = turnoStateFor(turno.estado).transicionarA(nextState);
      } catch (error) {
        if (error instanceof TransicionTurnoInvalidaError) {
          throw new ConflictException(error.message);
        }
        throw error;
      }
      const saved = await repository.save(turno);
      // HU 1.3: el horario liberado pasa al primero de la lista de espera, en la misma transacción.
      const promovido =
        nextState === EstadoTurno.CANCELADO
          ? await this.promoteFromStandby(manager, saved)
          : null;
      return {
        summary: this.toSummary(saved),
        patientId: turno.paciente?.id,
        promovido,
      };
    });
    const occurredAt = new Date().toISOString();
    if (nextState === EstadoTurno.ATENDIDO) {
      this.events.publish({
        type: 'admissions.appointment-attended',
        occurredAt,
        payload: { appointmentId: id, urgente: result.summary.urgente },
      });
    }
    if (nextState === EstadoTurno.EN_SALA_DE_ESPERA) {
      // Alerta al consultorio del médico (HU 2.1, escenario 1).
      this.events.publish({
        type: 'admissions.patient-waiting',
        occurredAt,
        payload: {
          appointmentId: id,
          doctorId: result.summary.medico.id,
          patientId: result.patientId,
        },
      });
    }
    if (result.promovido) {
      this.events.publish({
        type: 'admissions.standby-promoted',
        occurredAt,
        payload: {
          appointmentId: result.promovido.turno.id,
          doctorId: result.promovido.turno.medico.id,
          patientId: result.promovido.paciente.id,
        },
      });
    }
    return { ...result.summary, promovido: result.promovido };
  }

  /**
   * HU 1.3: al cancelarse un turno, el horario liberado se le asigna al primero de la cola de
   * espera de ese médico y día. Se salta a quien ya tenga otro turno en ese horario.
   * Corre dentro de la transacción de la cancelación, con el lock del médico ya tomado.
   */
  private async promoteFromStandby(
    manager: EntityManager,
    cancelled: Turno,
  ): Promise<PromocionStandby | null> {
    if (cancelled.fechaHora <= new Date()) return null;
    const standby = manager.getRepository(EntreturnoStandby);
    const queue = await standby.find({
      where: {
        medico: { id: cancelled.medico.id },
        fecha: clinicDateOf(cancelled.fechaHora),
        estado: EstadoStandby.EN_COLA,
      },
      relations: { paciente: true },
      order: { createdAt: 'ASC' },
    });
    const repository = manager.getRepository(Turno);
    for (const entry of queue) {
      if (
        await this.patientHasOverlap(
          repository,
          entry.paciente.id,
          cancelled.fechaHora,
          cancelled.duracionMinutos,
        )
      ) {
        continue;
      }
      const created = await repository.save(
        repository.create({
          medico: cancelled.medico,
          paciente: entry.paciente,
          fechaHora: cancelled.fechaHora,
          duracionMinutos: cancelled.duracionMinutos,
          urgente: cancelled.urgente,
          estado: EstadoTurno.RESERVADO,
        }),
      );
      entry.estado = EstadoStandby.ASIGNADO;
      entry.turno = created;
      await standby.save(entry);
      return {
        turno: this.toSummary(created),
        paciente: {
          id: entry.paciente.id,
          nombre: entry.paciente.nombre,
          apellido: entry.paciente.apellido,
        },
      };
    }
    return null;
  }

  /** Destinos válidos por estado, para que el front habilite el drag & drop. */
  getTransitionTable(): Record<string, EstadoTurno[]> {
    return tablaTransiciones();
  }

  private async createReservation(
    manager: EntityManager,
    doctor: Usuario,
    patientId: string,
    start: Date,
    duration: number,
    urgent: boolean,
  ): Promise<TurnoSummary> {
    const patient = await manager.getRepository(Paciente).findOne({
      where: { id: patientId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!patient) throw new NotFoundException('No se encontró el paciente.');
    const repository = manager.getRepository(Turno);
    if (
      await this.patientHasOverlap(repository, patient.id, start, duration)
    ) {
      throw new ConflictException(
        'El paciente ya tiene un turno reservado en ese horario.',
      );
    }
    try {
      const saved = await repository.save(
        repository.create({
          medico: doctor,
          paciente: patient,
          fechaHora: start,
          duracionMinutos: duration,
          estado: EstadoTurno.RESERVADO,
          urgente: urgent,
        }),
      );
      return this.toSummary(saved);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'Este turno acaba de ser ocupado. Elegí otro horario.',
        );
      }
      throw error;
    }
  }

  async lockDoctor(
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
  ): Promise<boolean> {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return (
      (await repository
        .createQueryBuilder('turno')
        .innerJoin('turno.medico', 'medico')
        .where('medico.id = :doctorId', { doctorId })
        .andWhere('turno.fechaHora < :end', { end })
        .andWhere(
          `turno.fechaHora + turno.duracionMinutos * INTERVAL '1 minute' > :start`,
          { start },
        )
        .andWhere('turno.estado NOT IN (:...inactive)', {
          inactive: NON_OCCUPYING_STATES,
        })
        .getCount()) > 0
    );
  }

  private async patientHasOverlap(
    repository: Repository<Turno>,
    patientId: string,
    start: Date,
    durationMinutes: number,
  ): Promise<boolean> {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    return (
      (await repository
        .createQueryBuilder('turno')
        .innerJoin('turno.paciente', 'paciente')
        .where('paciente.id = :patientId', { patientId })
        .andWhere('turno.estado IN (:...states)', {
          states: PATIENT_ACTIVE_STATES,
        })
        .andWhere('turno.fechaHora < :end', { end })
        .andWhere(
          `turno.fechaHora + turno.duracionMinutos * INTERVAL '1 minute' > :start`,
          { start },
        )
        .getCount()) > 0
    );
  }

  private parseDate(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('La fecha del turno no es válida.');
    }
    return date;
  }

  private assertNotPast(date: Date): void {
    if (date <= new Date()) {
      throw new ConflictException('Este turno ya pasó. Elegí otro horario.');
    }
  }

  /** ¿Cae exactamente en minuto `offset` de cada media hora (0 → :00/:30, 15 → :15/:45)? */
  private isAligned(date: Date, offset: number): boolean {
    return (
      date.getUTCMinutes() % 30 === offset &&
      date.getUTCSeconds() === 0 &&
      date.getUTCMilliseconds() === 0
    );
  }

  /** El horario regular de 30 min debe entrar completo en la jornada del médico. */
  private assertWithinSchedule(doctor: Usuario, slotStart: Date): void {
    const minutes = clinicMinutesOfDay(slotStart);
    if (
      minutes < scheduleMinutes(doctor.horaInicio) ||
      minutes + STANDARD_DURATION_MINUTES > scheduleMinutes(doctor.horaFin)
    ) {
      throw new BadRequestException(
        `El médico atiende de ${doctor.horaInicio.slice(0, 5)} a ${doctor.horaFin.slice(0, 5)}.`,
      );
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    const e = error as { code?: string; driverError?: { code?: string } };
    return e?.code === '23505' || e?.driverError?.code === '23505';
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

  assertCanManageDoctor(
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
