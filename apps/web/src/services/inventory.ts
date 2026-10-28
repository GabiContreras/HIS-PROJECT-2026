export interface InventoryItem {
  id: string;
  nombre: string;
  unidadMedida: string;
  cantidadDisponible: number;
}

export const LOW_STOCK_THRESHOLD = 10;
export const IBUPROFEN_ID = '1';

// Datos de prueba en memoria mientras no exista el endpoint de insumos.
const items: InventoryItem[] = [
  { id: IBUPROFEN_ID, nombre: 'Ibuprofeno 400mg', unidadMedida: 'comprimidos', cantidadDisponible: 50 },
  { id: '2', nombre: 'Guantes descartables', unidadMedida: 'cajas', cantidadDisponible: 42 },
  { id: '3', nombre: 'Jeringas 5 ml', unidadMedida: 'unidades', cantidadDisponible: 180 },
  { id: '4', nombre: 'Barbijos quirúrgicos', unidadMedida: 'cajas', cantidadDisponible: 8 },
  { id: '5', nombre: 'Suero fisiológico 500 ml', unidadMedida: 'unidades', cantidadDisponible: 25 },
  { id: '6', nombre: 'Gasas estériles', unidadMedida: 'paquetes', cantidadDisponible: 6 },
];

export async function listInventory(): Promise<InventoryItem[]> {
  return items.map((i) => ({ ...i })); // TODO: http.get<InventoryItem[]>('/insumos')
}

/** Descuento atómico: nunca deja el stock en negativo. */
export async function decrementStock(id: string, quantity = 1): Promise<InventoryItem> {
  const item = items.find((i) => i.id === id);
  if (!item) throw new Error('No se encontró el insumo.');
  if (item.cantidadDisponible < quantity) throw new Error(`Stock insuficiente de ${item.nombre}.`);
  item.cantidadDisponible -= quantity;
  return { ...item };
}
