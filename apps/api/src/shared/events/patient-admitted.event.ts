import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface PatientAdmittedPayload {
  /** Identificador del ingreso/internación; Enfermería lo usa como clave de idempotencia. */
  admissionId: string;
  patientId: string;
  /** Motivo o diagnóstico inicial en texto libre (p. ej. "Cirugía programada", "Neumonía"). */
  reason: string;
  admittedAt: string;
}

export class PatientAdmitted extends IntegrationEvent<PatientAdmittedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.PATIENT_ADMITTED;
  readonly type = PatientAdmitted.EVENT_TYPE;
}
