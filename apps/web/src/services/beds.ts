export type BedStatus = 'DISPONIBLE' | 'OCUPADA' | 'RESERVADA' | 'MANTENIMIENTO';

export interface Bed {
  id: string;
  numero: string;
  sector: string;
  estado: BedStatus;
  paciente: string | null;
}

const STATES: BedStatus[] = ['OCUPADA', 'DISPONIBLE', 'RESERVADA', 'MANTENIMIENTO'];

const MOCK: Bed[] = Array.from({ length: 30 }, (_, i) => ({
  id: String(i + 1),
  numero: String(i + 1).padStart(2, '0'),
  sector: i < 15 ? 'Clínica médica' : 'Cirugía',
  estado: STATES[i % STATES.length] ?? 'DISPONIBLE',
  paciente: i % 4 === 0 ? 'Paciente de prueba' : null,
}));

export async function listBeds(): Promise<Bed[]> {
  return MOCK; // TODO: http.get<Bed[]>('/camas') cuando exista el endpoint
}

export async function getBed(id: string): Promise<Bed | undefined> {
  return MOCK.find((b) => b.id === id);
}