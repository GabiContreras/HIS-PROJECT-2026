export type TriagePriority = 'ALTA' | 'MEDIA' | 'BAJA';

export interface TriageEntry {
  id: string;
  paciente: string;
  motivo: string;
  prioridad: TriagePriority;
  esperaMin: number;
}

const MOCK: TriageEntry[] = [
  { id: '1', paciente: 'María Gómez', motivo: 'Dolor torácico', prioridad: 'ALTA', esperaMin: 5 },
  { id: '2', paciente: 'Tomás Herrera', motivo: 'Fiebre alta persistente', prioridad: 'MEDIA', esperaMin: 18 },
  { id: '3', paciente: 'Lucía Fernández', motivo: 'Esguince de tobillo', prioridad: 'BAJA', esperaMin: 35 },
  { id: '4', paciente: 'Raúl Benítez', motivo: 'Dificultad respiratoria', prioridad: 'ALTA', esperaMin: 9 },
  { id: '5', paciente: 'Carla Molina', motivo: 'Dolor abdominal', prioridad: 'MEDIA', esperaMin: 24 },
];

export async function listTriage(): Promise<TriageEntry[]> {
  return MOCK; // TODO: http.get<TriageEntry[]>('/triaje') cuando exista el endpoint
}