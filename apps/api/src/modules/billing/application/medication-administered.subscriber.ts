import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from '../../../shared/events/domain-event.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import {
  MedicationAdministeredPayload,
} from '../../../shared/events/medication-administered.event.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { BillingService } from './billing.service.js';

export const BILLING_MEDICATION_CONSUMER = 'billing.medication-administered';

@Injectable()
export class MedicationAdministeredSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly outbox: OutboxService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.outbox.registerConsumer({
      name: BILLING_MEDICATION_CONSUMER,
      eventType: INTEGRATION_EVENTS.MEDICATION_ADMINISTERED,
      handle: (event) =>
        this.handle(event as DomainEvent<MedicationAdministeredPayload>),
    });
  }

  onModuleDestroy(): void {
    this.outbox.unregisterConsumer(BILLING_MEDICATION_CONSUMER);
  }

  handle(event: DomainEvent<MedicationAdministeredPayload>): Promise<void> {
    return this.billing
      .createForMedicationAdministration(event.payload)
      .then(() => undefined);
  }
}
