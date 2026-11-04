import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface BedAssignedPayload {
  bedId: string;
  bedNumber: string;
  patientId: string;
  assignedAt: string;
}

export class BedAssigned extends IntegrationEvent<BedAssignedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.BED_ASSIGNED;
  readonly type = BedAssigned.EVENT_TYPE;
}