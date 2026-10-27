// Tipado basado en el backend
export interface Cama {
  numero: string | number;
  sector: string;
  estado: 'Disponible' | 'Ocupada' | 'Mantenimiento';
  pacienteActual?: string | null;
}

const CAMAS_MOCK: Cama[] = [
  { numero: 101, sector: 'Urgencias', estado: 'Ocupada', pacienteActual: 'Juan Pérez' },
  { numero: 102, sector: 'Urgencias', estado: 'Disponible', pacienteActual: null }
];

export async function listarCamas(): Promise<Cama[]> {
  // TODO: http.get('/camas') cuando exista el endpoint
  return CAMAS_MOCK;
}