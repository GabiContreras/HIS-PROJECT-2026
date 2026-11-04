import { CoverageType } from './coverage-type.js';
import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface AppointmentAttendedPayload {
  appointmentId: string;
  patientId: string;
  doctorId: string;
  serviceCode: string;
  coverageType: CoverageType;
  baseAmount: number;
  attendedAt: string;
}

export class AppointmentAttended extends IntegrationEvent<AppointmentAttendedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.APPOINTMENT_ATTENDED;
  readonly type = AppointmentAttended.EVENT_TYPE;
}