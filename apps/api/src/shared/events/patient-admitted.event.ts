import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface PatientAdmittedPayload {
  admissionId: string;
  patientId: string;
  reason: string;
  admittedAt: string;
}

export class PatientAdmitted extends IntegrationEvent<PatientAdmittedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.PATIENT_ADMITTED;
  readonly type = PatientAdmitted.EVENT_TYPE;
}
