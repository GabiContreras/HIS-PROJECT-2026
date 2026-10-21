import { CoverageType } from './coverage-type.js';
import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface PatientRegisteredPayload {
  patientId: string;
  documentNumber: string;
  fullName: string;
  coverageType: CoverageType;
}

export class PatientRegistered extends IntegrationEvent<PatientRegisteredPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.PATIENT_REGISTERED;
  readonly type = PatientRegistered.EVENT_TYPE;
}