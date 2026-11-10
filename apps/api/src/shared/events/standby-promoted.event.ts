import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface StandbyPromotedPayload {
  appointmentId: string;
  doctorId: string;
  patientId: string;
  scheduledAt: string;
}

export class StandbyPromoted extends IntegrationEvent<StandbyPromotedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.STANDBY_PROMOTED;
  readonly type = StandbyPromoted.EVENT_TYPE;
}
