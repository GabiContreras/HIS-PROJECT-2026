import { http } from '../shared/http';

export interface InventoryItem {
  id: string;
  nombre: string;
  unidadMedida: string;
  cantidadDisponible: number;
}

export function listInventory(): Promise<InventoryItem[]> {
  return http.get<InventoryItem[]>('/resources/inventory');
}
