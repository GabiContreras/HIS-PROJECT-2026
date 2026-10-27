export interface InventoryItem {
  nombre: string;
  cantidadDisponible: number;
}

const INSUMOS_MOCK: InventoryItem[] = [
  { nombre: 'Paracetamol 500mg', cantidadDisponible: 150 },
  { nombre: 'Jeringas 10ml', cantidadDisponible: 40 },
  { nombre: 'Gasas estériles', cantidadDisponible: 85 }
];

export async function listInventory(): Promise<InventoryItem[]> {
  // TODO: http.get('/insumos') cuando exista el endpoint
  return INSUMOS_MOCK;
}