import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Subscription } from 'rxjs';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { DomainEvent } from '../../../shared/events/domain-event.js';
import { BillingService } from './billing.service.js';

export interface AppointmentAttendedPayload {
  appointmentId: string;
  urgente: boolean;
}

export const APPOINTMENT_ATTENDED_EVENT = 'admissions.appointment-attended';

@Injectable()
export class AppointmentAttendedSubscriber
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AppointmentAttendedSubscriber.name);
  private subscription?: Subscription;

  constructor(
    private readonly events: EventBus,
    private readonly billing: BillingService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.events
      .ofType<AppointmentAttendedPayload>(APPOINTMENT_ATTENDED_EVENT)
      .subscribe((event) => {
        void this.handle(event).catch((error: unknown) => {
          this.logger.error(
            `No se pudo registrar el cargo del turno ${event.payload.appointmentId}.`,
            error instanceof Error ? error.stack : undefined,
          );
        });
      });
  }

  onModuleDestroy(): void {
    this.subscription?.unsubscribe();
  }

  handle(event: DomainEvent<AppointmentAttendedPayload>): Promise<void> {
    return this.billing.createForAppointment(event.payload).then(() => undefined);
  }
}
