import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { EntreturnoStandby, EstadoStandby } from '../../../entities/entreturno-standby.entity.js';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import { EstadoTurno, Turno } from '../../../entities/turno.entity.js';
import {
  AuthService,
  PublicAccount,
  SessionIdentity,
} from '../application/auth.service.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';
import { HorarioMedicoDto } from './dto/horario-medico.dto.js';

@Injectable()
export class AccountAdminService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(RefreshSession)
    private readonly sesiones: Repository<RefreshSession>,
    private readonly auth: AuthService,
    private readonly dataSource: DataSource,
  ) {}

  /** Las cuentas dadas de baja solo se listan si lo pide un superadmin. */
  async list(
    actor: SessionIdentity,
    incluirBajas = false,
  ): Promise<PublicAccount[]> {
    const accounts = await this.usuarios.find({
      where:
        actor.esSuperadmin && incluirBajas
          ? {}
          : { estado: Not(EstadoCuenta.BAJA) },
      order: { createdAt: 'DESC' },
    });
    return accounts.map((account) => this.toPublicAccount(account));
  }

  async get(id: string): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    return this.toPublicAccount(account);
  }

  async updateProfile(
    id: string,
    dto: UpdateUserDto,
    actor: SessionIdentity,
  ): Promise<PublicAccount> {
    const nombre = dto.nombre?.trim();
    const apellido = dto.apellido?.trim();
    if (!nombre && !apellido) {
      throw new BadRequestException(
        'Indicá al menos un campo para actualizar.',
      );
    }
    const account = await this.findAccount(id);
    if (account.esSuperadmin) {
      throw new ConflictException(
        'El perfil del superadmin raíz no puede modificarse desde administración.',
      );
    }
    // Cada administrativo puede corregir su propio nombre; el de otros, solo el superadmin.
    this.assertCanManage(actor, account, { allowSelf: true });
    if (dto.nombre !== undefined) {
      if (!nombre) {
        throw new BadRequestException('El nombre no puede quedar vacío.');
      }
      account.nombre = nombre;
    }
    if (dto.apellido !== undefined) {
      if (!apellido) {
        throw new BadRequestException('El apellido no puede quedar vacío.');
      }
      account.apellido = apellido;
    }
    return this.toPublicAccount(await this.usuarios.save(account));
  }

  /** Asigna la jornada de atención del médico (la disponibilidad se calcula con ella). */
  async updateSchedule(
    id: string,
    dto: HorarioMedicoDto,
    actor: SessionIdentity,
  ): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    this.assertCanManage(actor, account);
    if (account.rol !== RolUsuario.MEDICO) {
      throw new ConflictException('Solo los médicos tienen horario de atención.');
    }
    const toMinutes = (time: string) => {
      const [hour, minute] = time.split(':').map(Number);
      return hour * 60 + minute;
    };
    const start = toMinutes(dto.horaInicio);
    const end = toMinutes(dto.horaFin);
    if (start < 8 * 60 || end > 20 * 60) {
      throw new BadRequestException(
        'El horario debe estar dentro del horario de la clínica (08:00 a 20:00).',
      );
    }
    if (start >= end) {
      throw new BadRequestException(
        'La hora de inicio debe ser anterior a la hora de fin.',
      );
    }
    account.horaInicio = dto.horaInicio;
    account.horaFin = dto.horaFin;
    return this.toPublicAccount(await this.usuarios.save(account));
  }

  async createAdministrator(dto: CreateAdminDto): Promise<PublicAccount> {
    return this.auth.createAdministrator(dto);
  }

  async enableDoctor(id: string, actor: SessionIdentity): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    this.assertCanManage(actor, account);
    if (
      !account.emailVerificado ||
      account.esSuperadmin ||
      ![
        EstadoCuenta.PENDIENTE_HABILITACION,
        EstadoCuenta.DESHABILITADO,
      ].includes(account.estado)
    ) {
      throw new ConflictException(
        'Solo se pueden habilitar cuentas verificadas pendientes o deshabilitadas.',
      );
    }
    account.estado = EstadoCuenta.ACTIVO;
    return this.toPublicAccount(await this.usuarios.save(account));
  }

  async deactivate(id: string, actor: SessionIdentity): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    if (account.esSuperadmin) {
      throw new ConflictException(
        'No se puede deshabilitar al superadmin raíz.',
      );
    }
    if (account.id === actor.accountId) {
      throw new ConflictException('No podés deshabilitar tu propia cuenta.');
    }
    this.assertCanManage(actor, account);
    account.estado = EstadoCuenta.DESHABILITADO;
    const saved = await this.usuarios.save(account);
    await this.sesiones.update(
      { usuarioId: id, revocadoEn: IsNull() },
      { revocadoEn: new Date() },
    );
    return this.toPublicAccount(saved);
  }

  /**
   * Baja lógica (solo superadmin): la cuenta se archiva sin borrar nada. No puede iniciar
   * sesión y deja de aparecer en listados y selectores; turnos e historial se conservan.
   * Un médico con turnos futuros activos no se puede dar de baja hasta resolverlos.
   */
  async dispose(id: string, actor: SessionIdentity): Promise<PublicAccount> {
    const initial = await this.findAccount(id);
    if (initial.esSuperadmin) {
      throw new ConflictException('No se puede dar de baja al superadmin raíz.');
    }
    if (initial.id === actor.accountId) {
      throw new ConflictException('No podés darte de baja a vos mismo.');
    }
    if (initial.estado === EstadoCuenta.BAJA) {
      throw new ConflictException('La cuenta ya está dada de baja.');
    }

    return this.dataSource.transaction(async (manager) => {
      // Mismo lock que usa la reserva de turnos: nadie reserva con el médico mientras se da de baja.
      const account = await manager.getRepository(Usuario).findOne({
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!account) throw new NotFoundException('No se encontró la cuenta.');

      if (account.rol === RolUsuario.MEDICO) {
        const pendientes = await manager
          .getRepository(Turno)
          .createQueryBuilder('turno')
          .innerJoin('turno.medico', 'medico')
          .where('medico.id = :id', { id })
          .andWhere('turno.estado IN (:...estados)', {
            estados: [
              EstadoTurno.RESERVADO,
              EstadoTurno.CONFIRMADO,
              EstadoTurno.EN_SALA_DE_ESPERA,
            ],
          })
          .andWhere('turno.fechaHora > :now', { now: new Date() })
          .getCount();
        if (pendientes > 0) {
          throw new ConflictException(
            `El médico tiene ${pendientes} turno${pendientes === 1 ? '' : 's'} pendiente${pendientes === 1 ? '' : 's'}. Cancelalos o reasignalos antes de dar de baja la cuenta.`,
          );
        }
        // Nadie queda esperando un horario de un médico que ya no atiende.
        await manager
          .createQueryBuilder()
          .update(EntreturnoStandby)
          .set({ estado: EstadoStandby.RETIRADO })
          .where('medico_id = :id AND estado = :estado', {
            id,
            estado: EstadoStandby.EN_COLA,
          })
          .execute();
      }

      account.estado = EstadoCuenta.BAJA;
      account.dadoDeBajaEn = new Date();
      const saved = await manager.getRepository(Usuario).save(account);
      await manager
        .getRepository(RefreshSession)
        .update({ usuarioId: id, revocadoEn: IsNull() }, { revocadoEn: new Date() });
      return this.toPublicAccount(saved);
    });
  }

  /** Restaura una baja: vuelve como DESHABILITADA para que alguien la habilite a propósito. */
  async restore(id: string): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    if (account.estado !== EstadoCuenta.BAJA) {
      throw new ConflictException('La cuenta no está dada de baja.');
    }
    account.estado = EstadoCuenta.DESHABILITADO;
    account.dadoDeBajaEn = null;
    return this.toPublicAccount(await this.usuarios.save(account));
  }

  /** Reglas comunes: una cuenta dada de baja no se toca, y los administrativos son del superadmin. */
  private assertCanManage(
    actor: SessionIdentity,
    target: Usuario,
    options: { allowSelf?: boolean } = {},
  ): void {
    if (target.estado === EstadoCuenta.BAJA) {
      throw new ConflictException(
        'La cuenta está dada de baja. Un superadmin debe restaurarla antes de modificarla.',
      );
    }
    const isSelf = target.id === actor.accountId;
    if (
      target.rol === RolUsuario.ADMINISTRATIVO &&
      !actor.esSuperadmin &&
      !(options.allowSelf && isSelf)
    ) {
      throw new ForbiddenException(
        'Solo el superadmin puede gestionar a otros administrativos.',
      );
    }
  }

  private async findAccount(id: string): Promise<Usuario> {
    const account = await this.usuarios.findOneBy({ id });
    if (!account) throw new NotFoundException('No se encontró la cuenta.');
    return account;
  }

  private toPublicAccount(account: Usuario): PublicAccount {
    return {
      id: account.id,
      nombre: account.nombre,
      apellido: account.apellido,
      email: account.email,
      rol: account.rol,
      estado: account.estado,
      esSuperadmin: account.esSuperadmin,
      ...(account.rol === RolUsuario.MEDICO
        ? {
            horaInicio: account.horaInicio?.slice(0, 5),
            horaFin: account.horaFin?.slice(0, 5),
          }
        : {}),
      ...(account.estado === EstadoCuenta.BAJA
        ? { dadoDeBajaEn: account.dadoDeBajaEn?.toISOString() ?? null }
        : {}),
    };
  }
}
