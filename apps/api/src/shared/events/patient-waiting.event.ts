import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface PatientWaitingPayload {
  appointmentId: string;
  doctorId: string;
  patientId: string;
}

export class PatientWaiting extends IntegrationEvent<PatientWaitingPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.PATIENT_WAITING;
  readonly type = PatientWaiting.EVENT_TYPE;
}
