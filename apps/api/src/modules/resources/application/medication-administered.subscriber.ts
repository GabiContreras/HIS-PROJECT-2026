import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import {
  MedicationAdministered,
  type MedicationAdministeredPayload,
} from '../../../shared/events/medication-administered.event.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { OrigenMovimientoInventario } from '../domain/inventory-movement.js';
import { InventoryService } from '../infrastructure/inventory.service.js';

export const INVENTORY_MEDICATION_CONSUMER = 'resources.medication-administered';

@Injectable()
export class MedicationAdministeredSubscriber implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly outbox: OutboxService,
    private readonly inventory: InventoryService,
  ) {}

  onModuleInit(): void {
    this.outbox.registerConsumer({
      name: INVENTORY_MEDICATION_CONSUMER,
      eventType: MedicationAdministered.EVENT_TYPE,
      handle: (event, manager) =>
        this.handle(event as DomainEvent<MedicationAdministeredPayload>, manager),
    });
  }

  onModuleDestroy(): void {
    this.outbox.unregisterConsumer(INVENTORY_MEDICATION_CONSUMER);
  }

  async handle(
    event: DomainEvent<MedicationAdministeredPayload>,
    manager?: EntityManager,
  ): Promise<(() => void) | void> {
    const { supplyId, quantity, administrationId } = event.payload;
    const input = {
      insumoId: supplyId,
      cantidad: quantity,
      usuarioId: null,
      origen: OrigenMovimientoInventario.ADMINISTRACION_MEDICACION,
      referenciaId: administrationId ?? null,
    };
    if (!manager) {
      await this.inventory.descontarStock(input);
      return;
    }
    const { publicarAlerta } = await this.inventory.descontarStockEnTransaccion(
      input,
      manager,
    );
    return publicarAlerta;
  }
}
