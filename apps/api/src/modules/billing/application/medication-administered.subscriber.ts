import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { DomainEvent } from '../../../shared/events/domain-event.js';
import {
  MedicationAdministeredPayload,
} from '../../../shared/events/medication-administered.event.js';
import { BillingService } from './billing.service.js';

@Injectable()
export class MedicationAdministeredSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(
    MedicationAdministeredSubscriber.name,
  );

  private subscription?: Subscription;

  constructor(
    private readonly events: EventBus,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events
      .ofType<MedicationAdministeredPayload>('medication.administered')
      .subscribe((event) => {
        void this.handle(event).catch((error: unknown) => {
          this.logger.error(
            `No se pudo registrar el cargo de farmacia de la administración ${event.payload.administrationId}.`,
            error instanceof Error ? error.stack : undefined,
          );
        });
      });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  handle(event: DomainEvent<MedicationAdministeredPayload>): Promise<void> {
    return this.billing
      .createForMedicationAdministration(event.payload)
      .then(() => undefined);
  }
}