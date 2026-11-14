import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, Not } from 'typeorm';
import { RefreshSession } from '../../../entities/refresh-session.entity.js';
import { Turno, EstadoTurno } from '../../../entities/turno.entity.js';
import {
  EstadoCuenta,
  RolUsuario,
  Usuario,
} from '../../../entities/usuario.entity.js';
import { AuthService, type SessionIdentity } from '../application/auth.service.js';
import type { UpdateUserDto } from './dto/update-user.dto.js';
import type { HorarioMedicoDto } from './dto/horario-medico.dto.js';
import type { CreateAdminDto } from './dto/create-admin.dto.js';
import type { ResetPasswordDto } from './dto/reset-password.dto.js';

@Injectable()
export class AccountAdminService {
  constructor(
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
    @InjectRepository(RefreshSession)
    private readonly refreshRepo: Repository<RefreshSession>,
    private readonly authService: AuthService,
    private readonly dataSource: DataSource,
  ) {}

  async list(actor: SessionIdentity, incluirBajas = false): Promise<Usuario[]> {
    const where: any = {};
    if (!actor.esSuperadmin || !incluirBajas) {
      where.estado = Not(EstadoCuenta.BAJA);
    }
   return this.usuarioRepo.find({
      where,
      select: [
        'id',
        'nombre',
        'apellido',
        'email',
        'rol',
        'estado',
        'esSuperadmin',
        'emailVerificado',
        'horaInicio',
        'horaFin',
        'dadoDeBajaEn',
        'createdAt',
      ] as any,
      order: { createdAt: 'DESC' },
    });
  }

  async get(id: string): Promise<Usuario> {
    const usuario = await this.usuarioRepo.findOneBy({ id });
    if (!usuario) {
      throw new NotFoundException('No se encontró la cuenta.');
    }
    return usuario;
  }

  async updateProfile(
    id: string,
    dto: UpdateUserDto,
    actor: SessionIdentity,
  ): Promise<Usuario> {
    const usuario = await this.get(id);

    if (usuario.estado === EstadoCuenta.BAJA) {
      throw new ConflictException('No se puede modificar una cuenta dada de baja.');
    }

    if (usuario.esSuperadmin && (usuario.id !== actor.accountId || !actor.esSuperadmin)) {
      throw new ConflictException('El perfil del superadmin raíz no se modifica desde administración.');
    }

    if (usuario.rol === RolUsuario.ADMINISTRATIVO && !actor.esSuperadmin && usuario.id !== actor.accountId) {
      throw new ForbiddenException('Un administrativo no puede modificar a otro administrativo.');
    }

    if (dto.nombre !== undefined) {
      const trimmed = dto.nombre.trim();
      if (!trimmed) {
        throw new BadRequestException('El nombre no puede quedar vacío.');
      }
      usuario.nombre = trimmed;
    }

    if (dto.apellido !== undefined) {
      const trimmed = dto.apellido.trim();
      if (!trimmed) {
        throw new BadRequestException('El apellido no puede quedar vacío.');
      }
      usuario.apellido = trimmed;
    }

    if (dto.nombre === undefined && dto.apellido === undefined) {
      throw new BadRequestException('Debe proporcionar al menos un campo para actualizar.');
    }

    return this.usuarioRepo.save(usuario);
  }

  async updateSchedule(
    id: string,
    dto: UpdateUserDto & HorarioMedicoDto,
    actor: SessionIdentity,
  ): Promise<Usuario> {
    const usuario = await this.get(id);

    if (usuario.estado === EstadoCuenta.BAJA) {
      throw new ConflictException('No se puede cambiar el horario de una cuenta dada de baja.');
    }

    if (usuario.rol !== RolUsuario.MEDICO) {
      throw new ConflictException('Solo los médicos tienen horario asignado.');
    }

    if (!actor.esSuperadmin && usuario.id !== actor.accountId) {
      // Verificación de rol administrativo / propio
    }

    const { horaInicio, horaFin } = dto;
    if (horaInicio < '08:00' || horaFin > '20:00' || horaInicio >= horaFin) {
      throw new BadRequestException('El horario debe estar entre las 08:00 y las 20:00 y ser coherente.');
    }

    usuario.horaInicio = horaInicio;
    usuario.horaFin = horaFin;
    return this.usuarioRepo.save(usuario);
  }

  async enableDoctor(id: string, actor: SessionIdentity): Promise<Usuario> {
    const usuario = await this.get(id);

    if (usuario.estado === EstadoCuenta.BAJA) {
      throw new ConflictException('No se puede habilitar una cuenta dada de baja.');
    }

    if (usuario.rol === RolUsuario.ADMINISTRATIVO && !actor.esSuperadmin) {
      throw new ForbiddenException('No autorizado.');
    }

    if (!usuario.emailVerificado) {
      throw new ConflictException('El correo electrónico no está verificado.');
    }

    if (usuario.estado !== EstadoCuenta.PENDIENTE_HABILITACION && usuario.estado !== EstadoCuenta.DESHABILITADO) {
      throw new ConflictException('La cuenta no se encuentra en un estado habilitable.');
    }

    usuario.estado = EstadoCuenta.ACTIVO;
    return this.usuarioRepo.save(usuario);
  }

  async deactivate(id: string, actor: SessionIdentity): Promise<Usuario> {
    const usuario = await this.get(id);

    if (usuario.esSuperadmin) {
      throw new ConflictException('No se puede deshabilitar al superadmin raíz.');
    }

    if (usuario.id === actor.accountId) {
      throw new ConflictException('No podés deshabilitar tu propia cuenta.');
    }

    if (usuario.rol === RolUsuario.ADMINISTRATIVO && !actor.esSuperadmin) {
      throw new ForbiddenException('Un administrativo no puede deshabilitar a otro administrativo.');
    }

    usuario.estado = EstadoCuenta.DESHABILITADO;
    const saved = await this.usuarioRepo.save(usuario);

    await this.refreshRepo.update({ usuarioId: id }, { revocadoEn: new Date() });

    return saved;
  }

  async dispose(id: string, actor: SessionIdentity): Promise<Usuario> {
    if (!actor.esSuperadmin) {
      throw new ForbiddenException('Solo el superadmin puede realizar bajas lógicas.');
    }

    return this.dataSource.transaction(async (manager) => {
      const usuarioRepo = manager.getRepository(Usuario);
      const turnoRepo = manager.getRepository(Turno);
      const refreshRepo = manager.getRepository(RefreshSession);

      const usuario = await usuarioRepo.findOne({ where: { id } });
      if (!usuario) {
        throw new NotFoundException('No se encontró la cuenta.');
      }

      if (usuario.esSuperadmin) {
        throw new ConflictException('No se puede dar de baja al superadmin raíz.');
      }

      if (usuario.id === actor.accountId) {
        throw new ConflictException('No podés dar de baja a vos mismo.');
      }

      if (usuario.estado === EstadoCuenta.BAJA) {
        throw new ConflictException('La cuenta ya está dada de baja.');
      }

      if (usuario.rol === RolUsuario.MEDICO) {
        const turnosPendientes = await turnoRepo
          .createQueryBuilder('t')
          .innerJoin('t.medico', 'm')
          .where('m.id = :id', { id })
          .andWhere('t.estado IN (:...estados)', {
            estados: [EstadoTurno.RESERVADO, EstadoTurno.CONFIRMADO, EstadoTurno.EN_SALA_DE_ESPERA],
          })
          .getCount();

        if (turnosPendientes > 0) {
          throw new ConflictException(`El médico tiene ${turnosPendientes} turnos pendientes y no puede ser dado de baja.`);
        }

        await manager
          .createQueryBuilder()
          .delete()
          .from('entreturno_standby')
          .where('medico_id = :id', { id })
          .andWhere('estado = :estado', { estado: 'EN_COLA' })
          .execute();
      }

      usuario.estado = EstadoCuenta.BAJA;
      usuario.dadoDeBajaEn = new Date();
      const saved = await usuarioRepo.save(usuario);

      await refreshRepo.update({ usuarioId: id }, { revocadoEn: new Date() });

      return saved;
    });
  }

  async restore(id: string): Promise<Usuario> {
    const usuario = await this.get(id);

    if (usuario.estado !== EstadoCuenta.BAJA) {
      throw new ConflictException('La cuenta no está dada de baja.');
    }

    usuario.estado = EstadoCuenta.DESHABILITADO;
    usuario.dadoDeBajaEn = null as any;
    return this.usuarioRepo.save(usuario);
  }

  async createAdministrator(dto: CreateAdminDto): Promise<Usuario> {
    return this.authService.createAdministrator(dto) as unknown as Usuario;
  }

  async resetPassword(
    id: string,
    dto: ResetPasswordDto,
    actor: SessionIdentity,
  ) {
    const usuario = await this.get(id);

    if (usuario.esSuperadmin) {
      throw new ConflictException('No se puede restablecer la contraseña del superadmin raíz.');
    }

    if (usuario.id === actor.accountId) {
      throw new BadRequestException('Para cambiar tu contraseña actual, realizá el cambio de contraseña con tu clave actual.');
    }

    if (usuario.rol === RolUsuario.ADMINISTRATIVO && !actor.esSuperadmin) {
      throw new ForbiddenException('Un administrativo común no puede resetear la clave de otro administrador.');
    }

    // Utiliza la propiedad que maneje el DTO (como passwordTemporal o password)
    const tempPass = (dto as any).passwordTemporal || (dto as any).password;
    return this.authService.setTemporaryPassword(id, tempPass);
  }
}