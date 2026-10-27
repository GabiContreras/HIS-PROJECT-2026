export interface InventoryItem {
  id: string;
  nombre: string;
  unidadMedida: string;
  cantidadDisponible: number;
}

const MOCK: InventoryItem[] = [
  { id: '1', nombre: 'Guantes descartables', unidadMedida: 'cajas', cantidadDisponible: 42 },
  { id: '2', nombre: 'Jeringas 5 ml', unidadMedida: 'unidades', cantidadDisponible: 180 },
  { id: '3', nombre: 'Barbijos quirúrgicos', unidadMedida: 'cajas', cantidadDisponible: 8 },
  { id: '4', nombre: 'Suero fisiológico 500 ml', unidadMedida: 'unidades', cantidadDisponible: 25 },
  { id: '5', nombre: 'Gasas estériles', unidadMedida: 'paquetes', cantidadDisponible: 6 },
];

export async function listInventory(): Promise<InventoryItem[]> {
  return MOCK; // TODO: http.get<InventoryItem[]>('/insumos') cuando exista el endpoint
}