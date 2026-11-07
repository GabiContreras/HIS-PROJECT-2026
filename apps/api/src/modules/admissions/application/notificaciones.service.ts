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

  async marcarComoLeida(id: string): Promise<NotificacionEntity> {
    const notif = await this.notificacionRepo.findOne({ where: { id } });
    if (!notif) {
      throw new NotFoundException(`Notificación con ID ${id} no encontrada`);
    }
    notif.leida = true;
    return await this.notificacionRepo.save(notif);
  }
}