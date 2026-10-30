import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface BedCleanedPayload {
  bedId: string;
  bedNumber: string;
  cleanedAt: string;
}

export class BedCleaned extends IntegrationEvent<BedCleanedPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.BED_CLEANED;
  readonly type = BedCleaned.EVENT_TYPE;
}