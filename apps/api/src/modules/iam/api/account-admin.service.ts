import {
  ConflictException,
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import {
  AuthService,
  PublicAccount,
  SessionIdentity,
} from '../application/auth.service.js';
import { CreateAdminDto } from './dto/create-admin.dto.js';
import { RestablecerClaveDto } from './dto/restablecer-clave.dto.js';
import { UpdateUserDto } from './dto/update-user.dto.js';

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

  async updateProfile(
    id: string,
    dto: UpdateUserDto,
    caller: SessionIdentity,
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
    this.assertCanManage(account, caller);
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

  async createAdministrator(dto: CreateAdminDto): Promise<PublicAccount> {
    return this.auth.createAdministrator(dto);
  }

  async enableDoctor(
    id: string,
    caller: SessionIdentity,
  ): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    this.assertCanManage(account, caller);
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

  async deactivate(
    id: string,
    caller: SessionIdentity,
  ): Promise<PublicAccount> {
    const account = await this.findAccount(id);
    if (account.esSuperadmin) {
      throw new ConflictException(
        'No se puede deshabilitar al superadmin raíz.',
      );
    }
    if (account.id === caller.accountId) {
      throw new ConflictException('No podés deshabilitar tu propia cuenta.');
    }
    this.assertCanManage(account, caller);
    account.estado = EstadoCuenta.DESHABILITADO;
    const saved = await this.usuarios.save(account);
    await this.sesiones.update(
      { usuarioId: id, revocadoEn: IsNull() },
      { revocadoEn: new Date() },
    );
    return this.toPublicAccount(saved);
  }

  async resetPassword(
    id: string,
    dto: RestablecerClaveDto,
    caller: SessionIdentity,
  ): Promise<{ message: string }> {
    const account = await this.findAccount(id);
    if (account.esSuperadmin) {
      throw new ConflictException(
        'La contraseña del superadmin raíz no puede restablecerse desde administración.',
      );
    }
    if (account.id === caller.accountId) {
      throw new ConflictException(
        'Para cambiar tu propia contraseña usá el cambio de contraseña con tu clave actual.',
      );
    }
    this.assertCanManage(account, caller);
    return this.auth.setTemporaryPassword(account.id, dto.passwordTemporal);
  }

  /**
   * Una cuenta administrativa solo puede ser gestionada por el superadmin.
   * El resto de los roles los gestiona cualquier administrativo.
   */
  private assertCanManage(account: Usuario, caller: SessionIdentity): void {
    if (account.rol === RolUsuario.ADMINISTRATIVO && !caller.esSuperadmin) {
      throw new ForbiddenException(
        'Solo el superadmin puede gestionar cuentas administrativas.',
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
    };
  }
}
