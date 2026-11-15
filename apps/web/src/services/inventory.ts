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
  motivo?: string;
}

export interface ReplenishStockResult {
  insumoId: string;
  cantidadRepuesta: number;
  cantidadActual: number;
}

export interface DiscountStockInput {
  insumoId: string;
  cantidad: number;
  motivo?: string;
}

export type StockMovementType = 'DESCUENTO' | 'REPOSICION';

export type StockMovementOrigin = 'MANUAL' | 'ADMINISTRACION_MEDICACION';

export interface StockMovement {
  id: string;
  tipo: StockMovementType;
  cantidad: number;
  stockResultante: number;
  usuarioId: string | null;
  origen: StockMovementOrigin;
  referenciaId: string | null;
  motivo: string | null;
  fecha: string;
}

export const LOW_STOCK_THRESHOLD = 10;

/** El stock lo descuenta el backend al registrarse una administración (evento medication.administered). */
export function listInventory(): Promise<InventoryItem[]> {
  return http.get<InventoryItem[]>('/resources/inventory');
}
