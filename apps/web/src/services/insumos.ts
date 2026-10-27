export interface Insumo {
  nombre: string;
  cantidadDisponible: number;
}

const INSUMOS_MOCK: Insumo[] = [
  { nombre: 'Paracetamol 500mg', cantidadDisponible: 150 },
  { nombre: 'Jeringas 10ml', cantidadDisponible: 40 },
  { nombre: 'Gasas estériles', cantidadDisponible: 85 }
];

export async function listarInsumos(): Promise<Insumo[]> {
  // TODO: http.get('/insumos') cuando exista el endpoint
  return INSUMOS_MOCK;
}