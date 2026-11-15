import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import {
  InventoryLowStock,
  type InventoryLowStockPayload,
} from '../../../shared/events/inventory-low-stock.event.js';
import { NotificacionesService } from '../../admissions/application/notificaciones.service.js';

export const TIPO_NOTIFICACION_STOCK_BAJO = 'STOCK_BAJO';
export const PRIORIDAD_NOTIFICACION_STOCK_BAJO = 'MEDIA';

@Injectable()
export class LowStockNotificationSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(LowStockNotificationSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly eventBus: EventBus,
    private readonly notificacionesService: NotificacionesService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.eventBus
      .ofType<InventoryLowStockPayload>(InventoryLowStock.EVENT_TYPE)
      .subscribe((event) => void this.handle(event));
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: DomainEvent<InventoryLowStockPayload>): Promise<void> {
    const { insumoId, nombre, unidadMedida, cantidadDisponible, stockMinimo } = event.payload;
    try {
      await this.notificacionesService.notificarPorRol(RolUsuario.ADMINISTRATIVO, {
        tipo: TIPO_NOTIFICACION_STOCK_BAJO,
        prioridad: PRIORIDAD_NOTIFICACION_STOCK_BAJO,
        mensaje: `Stock bajo: ${nombre} tiene ${cantidadDisponible} ${unidadMedida} (mínimo ${stockMinimo})`,
      });
    } catch (error) {
      this.logger.error(
        `No se pudo notificar el stock bajo del insumo ${insumoId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
