import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface AppointmentBookedPayload {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  /** ISO-8601 UTC */
  scheduledAt: string;
}

export class AppointmentBooked extends IntegrationEvent<AppointmentBookedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.APPOINTMENT_BOOKED;
  readonly type = AppointmentBooked.EVENT_TYPE;
}