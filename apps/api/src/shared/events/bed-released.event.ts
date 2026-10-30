import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface BedReleasedPayload {
  bedId: string;
  bedNumber: string;
  patientId: string;
  admissionId: string;
  releasedAt: string;
}

export class BedReleased extends IntegrationEvent<BedReleasedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.BED_RELEASED;
  readonly type = BedReleased.EVENT_TYPE;
}