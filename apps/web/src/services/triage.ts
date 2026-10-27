export interface TriajeItem {
  id: string;
  paciente: string;
  nivelPrioridad: 1 | 2 | 3 | 4 | 5;
  motivo: string;
}

const TRIAJE_MOCK: TriajeItem[] = [
  { id: '1', paciente: 'María Gómez', nivelPrioridad: 2, motivo: 'Dolor torácico' }
];

export async function listarTriajes(): Promise<TriajeItem[]> {
  // TODO: http.get('/triaje') cuando exista el endpoint
  return TRIAJE_MOCK;
}