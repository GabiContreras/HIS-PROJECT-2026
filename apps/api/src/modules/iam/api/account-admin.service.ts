import {
  ConflictException,
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import { AuthService, PublicAccount } from '../application/auth.service.js';
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
  ) {}

  async list(): Promise<PublicAccount[]> {
    const accounts = await this.usuarios.find({ order: { createdAt: 'DESC' } });
    return accounts.map((account) => this.toPublicAccount(account));
  }

  async get(id: string): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    return this.toPublicAccount(account);
  }

  async updateProfile(id: string, dto: UpdateUserDto): Promise<PublicAccount> {
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
  ): Promise<PublicAccount> {
    const account = await this.findAccount(id);
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

  async enableDoctor(id: string): Promise<PublicAccount> {
    const account = await this.findAccount(id);
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

  async deactivate(id: string): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    if (account.esSuperadmin) {
      throw new ConflictException(
        'No se puede deshabilitar al superadmin raíz.',
      );
    }
    account.estado = EstadoCuenta.DESHABILITADO;
    const saved = await this.usuarios.save(account);
    await this.sesiones.update(
      { usuarioId: id, revocadoEn: IsNull() },
      { revocadoEn: new Date() },
    );
    return this.toPublicAccount(saved);
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
    };
  }
}
