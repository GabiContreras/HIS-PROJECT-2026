/**
 * Eventos de cama que nacen y se consumen dentro de Recursos (bloqueo por mantenimiento).
 * Los de asignación, alta y limpieza son eventos de integración y viven en `shared/events`.
 */
export const BED_BLOCKED = INTEGRATION_EVENTS.BED_BLOCKED;
export const BED_UNBLOCKED = INTEGRATION_EVENTS.BED_UNBLOCKED;

export interface BedBlockedPayload {
  bedId: string;
  bedNumber: string;
  blockedAt: string;
}

export interface BedUnblockedPayload {
  bedId: string;
  bedNumber: string;
  unblockedAt: string;
}
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
