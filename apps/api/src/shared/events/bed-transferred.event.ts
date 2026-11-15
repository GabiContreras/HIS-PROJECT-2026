import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface BedTransferredPayload {
  internacionId: string;
  patientId: string;
  camaOrigenId: string;
  camaDestinoId: string;
  camaOrigenNumero: string;
  camaDestinoNumero: string;
  fechaIngreso: string;
  fechaEgreso: null;
  trasladadoEn: string;
}

export class BedTransferred extends IntegrationEvent<BedTransferredPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.BED_TRANSFERRED;
  readonly type = BedTransferred.EVENT_TYPE;
}
