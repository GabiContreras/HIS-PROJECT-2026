import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificacionEntity } from '../../../entities/notificacion.entity.js';

@Injectable()
export class NotificacionesService {
  constructor(
    @InjectRepository(NotificacionEntity)
    private readonly notificacionRepo: Repository<NotificacionEntity>,
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

  async obtenerPorUsuario(destinatarioId: string): Promise<NotificacionEntity[]> {
    return await this.notificacionRepo.find({
      where: { destinatarioId },
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