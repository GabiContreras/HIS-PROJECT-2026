import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { BedReleasedPayload } from '../../../shared/events/bed-released.event.js';
import { DomainEvent } from '../../../shared/events/domain-event.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { BillingService } from './billing.service.js';

export const BILLING_BED_RELEASED_CONSUMER = 'billing.bed-released';

@Injectable()
export class BedReleasedSubscriber implements OnModuleInit, OnModuleDestroy {
  constructor(
    private readonly outbox: OutboxService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.outbox.registerConsumer({
      name: BILLING_BED_RELEASED_CONSUMER,
      eventType: INTEGRATION_EVENTS.BED_RELEASED,
      handle: (event) => this.handle(event as DomainEvent<BedReleasedPayload>),
    });
  }

  onModuleDestroy(): void {
    this.outbox.unregisterConsumer(BILLING_BED_RELEASED_CONSUMER);
  }

  handle(event: DomainEvent<BedReleasedPayload>): Promise<void> {
    return this.billing.createForBedStay(event.payload).then(() => undefined);
  }
}
