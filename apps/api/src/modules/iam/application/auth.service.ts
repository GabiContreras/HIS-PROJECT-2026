import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, QueryFailedError, Repository } from 'typeorm';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import { CreateAdminDto } from '../api/dto/create-admin.dto.js';
import { RegistroDto } from '../api/dto/registro.dto.js';
import { PasswordHasher } from './password-hasher.js';
import { TokenService } from './token.service.js';

const LOGIN_ATTEMPT_LIMIT = 5;
const LOGIN_LOCK_SECONDS = 15 * 60;

export interface AuthenticatedAccount {
  accessToken: string;
  refreshToken: string;
  account: PublicAccount;
}

export interface PublicAccount {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  rol: RolUsuario;
  estado: EstadoCuenta;
  esSuperadmin: boolean;
}

export interface SessionIdentity {
  accountId: string;
  sessionId: string;
  rol: RolUsuario;
  esSuperadmin: boolean;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarios: Repository<Usuario>,
    @InjectRepository(RefreshSession)
    private readonly sesiones: Repository<RefreshSession>,
    private readonly dataSource: DataSource,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService,
  ) {}

  async createAdministrator(dto: CreateAdminDto): Promise<PublicAccount> {
    const nombre = dto.nombre.trim();
    const apellido = dto.apellido.trim();
    if (!nombre || !apellido) {
      throw new BadRequestException('Nombre y apellido son obligatorios.');
    }
    const account = this.usuarios.create({
      nombre,
      apellido,
      email: this.normalizeEmail(dto.email),
      passwordHash: await this.passwordHasher.hash(dto.password),
      rol: RolUsuario.ADMINISTRATIVO,
      estado: EstadoCuenta.ACTIVO,
      emailVerificado: true,
      esSuperadmin: false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });
    try {
      const saved = await this.usuarios.save(account);
      return this.toPublicAccount(saved);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw error;
    }
  }

  /**
   * Alta de personal médico o de enfermería. Solo se invoca desde
   * `POST /usuarios`, que exige un administrativo autenticado; el método no
   * se expone como ruta pública ni depende de NODE_ENV.
   */
  async createStaff(dto: RegistroDto): Promise<{ message: string }> {
    const nombre = dto.nombre.trim();
    const apellido = dto.apellido.trim();
    if (!nombre || !apellido) {
      throw new BadRequestException('Nombre y apellido son obligatorios.');
    }
    const email = this.normalizeEmail(dto.email);
    const account = this.usuarios.create({
      nombre,
      apellido,
      email,
      passwordHash: await this.passwordHasher.hash(dto.password),
      rol: dto.rol,
      estado:
        dto.rol === RolUsuario.MEDICO
          ? EstadoCuenta.PENDIENTE_HABILITACION
          : EstadoCuenta.ACTIVO,
      emailVerificado: true,
      esSuperadmin: false,
      intentosFallidos: 0,
      bloqueadoHasta: null,
    });

    try {
      await this.usuarios.save(account);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException('Ya existe una cuenta con ese correo.');
      }
      throw error;
    }

    return {
      message:
        account.estado === EstadoCuenta.ACTIVO
          ? 'La cuenta fue creada y ya puede iniciar sesión.'
          : 'La cuenta fue creada. Un administrador debe habilitarla.',
    };
  }

  async login(
    emailInput: string,
    password: string,
  ): Promise<AuthenticatedAccount> {
    const user = await this.findByEmail(emailInput);
    if (!user) {
      await this.passwordHasher.hash(password);
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    const now = new Date();
    if (user.bloqueadoHasta && user.bloqueadoHasta > now) {
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    let passwordMatches = await this.passwordHasher.verify(
      password,
      user.passwordHash,
    );
    if (
      !passwordMatches &&
      process.env.NODE_ENV !== 'production' &&
      !user.passwordHash.startsWith('scrypt$')
    ) {
      const legacyHash = Buffer.from(user.passwordHash);
      const submittedPassword = Buffer.from(password);
      passwordMatches =
        legacyHash.length === submittedPassword.length &&
        timingSafeEqual(legacyHash, submittedPassword);
      if (passwordMatches) {
        user.passwordHash = await this.passwordHasher.hash(password);
      }
    }
    if (!passwordMatches) {
      await this.dataSource.transaction(async (manager) => {
        const lockedUser = await manager.getRepository(Usuario).findOne({
          where: { id: user.id },
          lock: { mode: 'pessimistic_write' },
        });
        if (!lockedUser) return;
        lockedUser.intentosFallidos += 1;
        if (lockedUser.intentosFallidos >= LOGIN_ATTEMPT_LIMIT) {
          lockedUser.intentosFallidos = 0;
          lockedUser.bloqueadoHasta = new Date(
            Date.now() + LOGIN_LOCK_SECONDS * 1000,
          );
        }
        await manager.getRepository(Usuario).save(lockedUser);
      });
      throw new UnauthorizedException('Correo o contraseña incorrectos.');
    }

    if (user.estado !== EstadoCuenta.ACTIVO) {
      throw new UnauthorizedException(
        'La cuenta no está habilitada para iniciar sesión.',
      );
    }

    user.intentosFallidos = 0;
    user.bloqueadoHasta = null;
    await this.usuarios.save(user);
    return this.openSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthenticatedAccount> {
    const tokenHash = this.tokenService.hashOpaqueValue(refreshToken);
    const outcome = await this.dataSource.transaction(async (manager) => {
      const sessionRepo = manager.getRepository(RefreshSession);
      const session = await sessionRepo.findOne({
        where: { tokenHash },
        lock: { mode: 'pessimistic_write' },
      });
      if (!session) return { kind: 'invalid' as const };

      const now = new Date();
      if (session.revocadoEn) {
        await sessionRepo.update(
          { familiaId: session.familiaId, revocadoEn: IsNull() },
          { revocadoEn: now },
        );
        return { kind: 'reused' as const };
      }
      if (session.expiraEn <= now) {
        session.revocadoEn = now;
        await sessionRepo.save(session);
        return { kind: 'invalid' as const };
      }

      const account = await manager.getRepository(Usuario).findOne({
        where: { id: session.usuarioId },
      });
      if (!account || account.estado !== EstadoCuenta.ACTIVO) {
        await sessionRepo.update(
          { familiaId: session.familiaId, revocadoEn: IsNull() },
          { revocadoEn: now },
        );
        return { kind: 'invalid' as const };
      }

      session.revocadoEn = now;
      await sessionRepo.save(session);
      const nextRefreshToken = this.tokenService.createRefreshToken();
      const nextSession = sessionRepo.create({
        usuario: account,
        usuarioId: account.id,
        familiaId: session.familiaId,
        tokenHash: this.tokenService.hashOpaqueValue(nextRefreshToken),
        expiraEn: new Date(
          now.getTime() + this.tokenService.refreshTokenTtlSeconds * 1000,
        ),
        revocadoEn: null,
      });
      await sessionRepo.save(nextSession);
      return {
        kind: 'rotated' as const,
        account,
        refreshToken: nextRefreshToken,
        sessionId: nextSession.id,
      };
    });

    if (outcome.kind !== 'rotated') {
      throw new UnauthorizedException(
        outcome.kind === 'reused'
          ? 'Se detectó reutilización del refresh token; la sesión fue revocada.'
          : 'La sesión venció o fue revocada.',
      );
    }
    return this.toAuthenticatedAccount(
      outcome.account,
      outcome.sessionId,
      outcome.refreshToken,
    );
  }

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await this.sesiones.update(
      { tokenHash: this.tokenService.hashOpaqueValue(refreshToken) },
      { revocadoEn: new Date() },
    );
  }

  async forgotPassword(_emailInput: string): Promise<{ message: string }> {
    return {
      message:
        'La recuperación por correo no está disponible. Pedile a un administrativo que restablezca tu contraseña.',
    };
  }

  /**
   * Asigna una contraseña temporal a una cuenta existente y revoca todas sus
   * sesiones. Las comprobaciones de permiso (quién puede restablecer a quién)
   * las hace `AccountAdminService` antes de llamar a este método.
   */
  async setTemporaryPassword(
    accountId: string,
    temporaryPassword: string,
  ): Promise<{ message: string }> {
    const passwordHash = await this.passwordHasher.hash(temporaryPassword);
    const affected = await this.dataSource.transaction(async (manager) => {
      const result = await manager.getRepository(Usuario).update(
        { id: accountId },
        { passwordHash, intentosFallidos: 0, bloqueadoHasta: null },
      );
      await manager
        .getRepository(RefreshSession)
        .update(
          { usuarioId: accountId, revocadoEn: IsNull() },
          { revocadoEn: new Date() },
        );
      return result.affected ?? 0;
    });
    if (affected === 0) {
      throw new NotFoundException('No se encontró la cuenta.');
    }
    return { message: 'La contraseña temporal fue asignada.' };
  }

  async changePassword(
    identity: SessionIdentity,
    currentPassword: string,
    newPassword: string,
  ): Promise<{ message: string }> {
    const user = await this.usuarios.findOneBy({ id: identity.accountId });
    if (
      !user ||
      !(await this.passwordHasher.verify(currentPassword, user.passwordHash))
    ) {
      throw new UnauthorizedException('La contraseña actual no es correcta.');
    }
    const passwordHash = await this.passwordHasher.hash(newPassword);
    await this.dataSource.transaction(async (manager) => {
      await manager
        .getRepository(Usuario)
        .update({ id: user.id }, { passwordHash });
      await manager
        .getRepository(RefreshSession)
        .createQueryBuilder()
        .update()
        .set({ revocadoEn: new Date() })
        .where('"usuarioId" = :userId', { userId: user.id })
        .andWhere('"revocadoEn" IS NULL')
        .andWhere('"id" != :sessionId', { sessionId: identity.sessionId })
        .execute();
    });
    return { message: 'La contraseña fue actualizada.' };
  }

  async getSessionIdentity(claims: {
    sub: string;
    sid: string;
    rol: RolUsuario;
    superadmin: boolean;
  }): Promise<SessionIdentity> {
    const [user, session] = await Promise.all([
      this.usuarios.findOneBy({ id: claims.sub }),
      this.sesiones.findOneBy({ id: claims.sid }),
    ]);
    if (
      !user ||
      !session ||
      session.usuarioId !== user.id ||
      session.revocadoEn ||
      session.expiraEn <= new Date() ||
      user.estado !== EstadoCuenta.ACTIVO ||
      user.rol !== claims.rol ||
      user.esSuperadmin !== claims.superadmin
    ) {
      throw new UnauthorizedException('La sesión no está activa.');
    }
    return {
      accountId: user.id,
      sessionId: session.id,
      rol: user.rol,
      esSuperadmin: user.esSuperadmin,
    };
  }

  async publicAccount(id: string): Promise<PublicAccount> {
    const user = await this.usuarios.findOneBy({ id });
    if (!user) throw new NotFoundException('No se encontró la cuenta.');
    return this.toPublicAccount(user);
  }

  private async openSession(user: Usuario): Promise<AuthenticatedAccount> {
    const refreshToken = this.tokenService.createRefreshToken();
    const session = this.sesiones.create({
      usuario: user,
      usuarioId: user.id,
      familiaId: randomUUID(),
      tokenHash: this.tokenService.hashOpaqueValue(refreshToken),
      expiraEn: new Date(
        Date.now() + this.tokenService.refreshTokenTtlSeconds * 1000,
      ),
      revocadoEn: null,
    });
    const saved = await this.sesiones.save(session);
    return this.toAuthenticatedAccount(user, saved.id, refreshToken);
  }

  private toAuthenticatedAccount(
    user: Usuario,
    sessionId: string,
    refreshToken: string,
  ): AuthenticatedAccount {
    return {
      accessToken: this.tokenService.issueAccessToken(user, sessionId),
      refreshToken,
      account: this.toPublicAccount(user),
    };
  }

  private toPublicAccount(user: Usuario): PublicAccount {
    return {
      id: user.id,
      nombre: user.nombre,
      apellido: user.apellido,
      email: user.email,
      rol: user.rol,
      estado: user.estado,
      esSuperadmin: user.esSuperadmin,
    };
  }

  private async findByEmail(email: string): Promise<Usuario | null> {
    return this.usuarios
      .createQueryBuilder('usuario')
      .where('LOWER(usuario.email) = :email', {
        email: this.normalizeEmail(email),
      })
      .getOne();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error.driverError as { code?: string }).code === '23505'
    );
  }
}
