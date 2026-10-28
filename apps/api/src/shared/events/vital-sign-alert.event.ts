import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface VitalSignAlertPayload {
  vitalSignId: string;
  patientId: string;
  tipo: string;
  valor: number;
  unidad: string;
  registeredBy: string;
  registeredAt: string;
}

export class VitalSignAlert extends IntegrationEvent<VitalSignAlertPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.VITAL_SIGN_ALERT;
  readonly type = VitalSignAlert.EVENT_TYPE;
}
