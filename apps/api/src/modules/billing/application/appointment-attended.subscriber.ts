import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { DomainEvent } from '../../../shared/events/domain-event.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { BillingService } from './billing.service.js';

export interface AppointmentAttendedPayload {
  appointmentId: string;
  urgente: boolean;
}

export const APPOINTMENT_ATTENDED_EVENT =
  INTEGRATION_EVENTS.ADMISSIONS_APPOINTMENT_ATTENDED;

export const APPOINTMENT_ATTENDED_CONSUMER = 'billing.appointment-attended';

@Injectable()
export class AppointmentAttendedSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  constructor(
    private readonly outbox: OutboxService,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.outbox.registerConsumer({
      name: APPOINTMENT_ATTENDED_CONSUMER,
      eventType: APPOINTMENT_ATTENDED_EVENT,
      handle: (event) =>
        this.handle(event as DomainEvent<AppointmentAttendedPayload>),
    });
  }

  onModuleDestroy(): void {
    this.outbox.unregisterConsumer(APPOINTMENT_ATTENDED_CONSUMER);
  }

  handle(event: DomainEvent<AppointmentAttendedPayload>): Promise<void> {
    return this.billing.createForAppointment(event.payload).then(() => undefined);
  }
}
