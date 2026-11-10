import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionEntity } from '../../../entities/notificacion.entity.js';
import { EstadoCuenta, RolUsuario, Usuario } from '../../../entities/usuario.entity.js';

export interface ContenidoNotificacion {
  tipo: string;
  prioridad: string;
  mensaje: string;
}

@Injectable()
export class NotificacionesService {
  private readonly logger = new Logger(NotificacionesService.name);

  constructor(
    @InjectRepository(NotificacionEntity)
    private readonly notificacionRepo: Repository<NotificacionEntity>,
    @InjectRepository(Usuario)
    private readonly usuarioRepo: Repository<Usuario>,
  ) {}

  async crearNotificacion(data: {
    destinatarioId: string;
    tipo: string;
    prioridad: string;
    mensaje: string;
  }): Promise<NotificacionEntity> {
    const notif = this.notificacionRepo.create(data);
    return await this.notificacionRepo.save(notif);
  }

  /** Nunca lanza: un fallo al notificar no debe romper la operación de negocio que lo disparó. */
  async notificarPorRol(rol: RolUsuario, contenido: ContenidoNotificacion): Promise<void> {
    try {
      const cuentas = await this.usuarioRepo.find({
        where: { rol, estado: EstadoCuenta.ACTIVO },
        select: { id: true },
      });
      await this.notificarUsuarios(
        cuentas.map((c) => c.id),
        contenido,
      );
    } catch (err) {
      this.logger.error(`No se pudo notificar al rol ${rol}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  /** Nunca lanza: si una notificación falla se registra y se sigue con las demás. */
  async notificarUsuarios(ids: string[], contenido: ContenidoNotificacion): Promise<void> {
    for (const destinatarioId of ids) {
      try {
        await this.crearNotificacion({ destinatarioId, ...contenido });
      } catch (err) {
        this.logger.error(
          `No se pudo notificar al usuario ${destinatarioId}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }

  async obtenerPorUsuario(destinatarioId: string, soloNoLeidas = false): Promise<NotificacionEntity[]> {
    return await this.notificacionRepo.find({
      where: soloNoLeidas ? { destinatarioId, leida: false } : { destinatarioId },
      order: { createdAt: 'DESC' },
    });
  }

  /** Solo el destinatario puede marcarla: si es de otro usuario responde 404, igual que si no existe. */
  async marcarComoLeida(id: string, destinatarioId: string): Promise<NotificacionEntity> {
    const notif = await this.notificacionRepo.findOne({ where: { id, destinatarioId } });
    if (!notif) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }
    notif.leida = true;
    return await this.notificacionRepo.save(notif);
  }
}