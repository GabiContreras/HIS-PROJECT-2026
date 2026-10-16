import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface MedicationAdministeredPayload {
  patientId: string;
  supplyId: string;
  quantity: number;
  administeredBy: string;
  administeredAt: string;
}

export class MedicationAdministered extends IntegrationEvent<MedicationAdministeredPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.MEDICATION_ADMINISTERED;
  readonly type = MedicationAdministered.EVENT_TYPE;
}