import { http } from '../shared/http';

export interface InventoryItem {
  id: string;
  nombre: string;
  unidadMedida: string;
  cantidadDisponible: number;
}

export interface InventoryItemDetail extends InventoryItem {
  precioPesos: number;
  stockMinimo: number;
}

export interface CreateInventoryItemInput {
  nombre: string;
  unidadMedida: string;
  precioPesos?: number;
  stockMinimo?: number;
}

export interface UpdateInventoryItemInput {
  unidadMedida?: string;
  precioPesos?: number;
  stockMinimo?: number;
}

export interface ReplenishStockInput {
  cantidad: number;
}

export interface ReplenishStockResult {
  insumoId: string;
  cantidadRepuesta: number;
  cantidadActual: number;
}

export const LOW_STOCK_THRESHOLD = 10;

/** El stock lo descuenta el backend al registrarse una administración (evento medication.administered). */
export function listInventory(): Promise<InventoryItem[]> {
  return http.get<InventoryItem[]>('/resources/inventory');
}
