import { IntegrationEvent } from './integration-event.base.js';
import { INTEGRATION_EVENTS } from './integration-event-names.js';

export interface InventoryLowStockPayload {
  insumoId: string;
  nombre: string;
  unidadMedida: string;
  cantidadDisponible: number;
  stockMinimo: number;
}

export class InventoryLowStock extends IntegrationEvent<InventoryLowStockPayload> {
  static readonly EVENT_TYPE = INTEGRATION_EVENTS.INVENTORY_LOW_STOCK;
  readonly type = InventoryLowStock.EVENT_TYPE;
}
