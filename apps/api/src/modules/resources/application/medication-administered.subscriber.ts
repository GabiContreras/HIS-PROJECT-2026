import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Subscription } from 'rxjs';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import {
  MedicationAdministered,
  type MedicationAdministeredPayload,
} from '../../../shared/events/medication-administered.event.js';
import { InventoryService } from '../infrastructure/inventory.service.js';

const MAX_IDS_RECORDADOS = 10_000;

@Injectable()
export class MedicationAdministeredSubscriber implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MedicationAdministeredSubscriber.name);
  private subscription?: Subscription;
  private readonly procesadas = new Set<string>();

  constructor(
    private readonly events: EventBus,
    private readonly inventory: InventoryService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events
      .ofType<MedicationAdministeredPayload>(MedicationAdministered.EVENT_TYPE)
      .subscribe((event) => {
        void this.handle(event);
      });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  async handle(event: DomainEvent<MedicationAdministeredPayload>): Promise<void> {
    const { supplyId, quantity, administrationId } = event.payload;
    if (administrationId) {
      if (this.procesadas.has(administrationId)) {
        this.logger.warn(`Administración ${administrationId} ya procesada; no se descuenta de nuevo.`);
        return;
      }
      this.recordar(administrationId);
    }
    try {
      await this.inventory.descontarStock({ insumoId: supplyId, cantidad: quantity });
    } catch (error) {
      if (administrationId) this.procesadas.delete(administrationId);
      this.logger.error(
        `No se pudo descontar ${quantity} unidad(es) del insumo ${supplyId} (administración ${administrationId ?? 'sin id'}): ${
          error instanceof Error ? error.message : String(error)
        }`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private recordar(id: string): void {
    if (this.procesadas.size >= MAX_IDS_RECORDADOS) {
      const masViejo = this.procesadas.values().next().value;
      if (masViejo !== undefined) this.procesadas.delete(masViejo);
    }
    this.procesadas.add(id);
  }
}
