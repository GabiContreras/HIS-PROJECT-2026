export type TriageLevel = 'ROJO' | 'AMARILLO' | 'VERDE';

export const TRIAGE_LABELS: Record<TriageLevel, string> = {
  ROJO: 'Riesgo vital (Código Rojo)',
  AMARILLO: 'Urgente',
  VERDE: 'No urgente',
};

export interface TriageEntry {
  id: string;
  paciente: string;
  motivo: string;
  nivel: TriageLevel;
  llegadaAt: string; // ISO
}

export type TriageInput = Pick<TriageEntry, 'paciente' | 'motivo' | 'nivel'>;

const RANK: Record<TriageLevel, number> = { ROJO: 0, AMARILLO: 1, VERDE: 2 };

/** Cola de espera: el riesgo vital va primero; dentro de cada nivel, por orden de llegada. */
export function sortQueue(entries: TriageEntry[]): TriageEntry[] {
  return [...entries].sort((a, b) => RANK[a.nivel] - RANK[b.nivel] || a.llegadaAt.localeCompare(b.llegadaAt));
}

const minutesAgo = (min: number) => new Date(Date.now() - min * 60_000).toISOString();

// Datos de prueba en memoria mientras no exista el endpoint de triaje.
const entries: TriageEntry[] = [
  { id: '1', paciente: 'Tomás Herrera', motivo: 'Fiebre alta persistente', nivel: 'AMARILLO', llegadaAt: minutesAgo(18) },
  { id: '2', paciente: 'Lucía Fernández', motivo: 'Esguince de tobillo', nivel: 'VERDE', llegadaAt: minutesAgo(35) },
  { id: '3', paciente: 'Carla Molina', motivo: 'Dolor abdominal', nivel: 'AMARILLO', llegadaAt: minutesAgo(24) },
];

export async function listTriage(): Promise<TriageEntry[]> {
  return entries.map((e) => ({ ...e })); // TODO: http.get<TriageEntry[]>('/triaje')
}

export async function addTriage(input: TriageInput): Promise<TriageEntry> {
  const entry: TriageEntry = { ...input, id: crypto.randomUUID(), llegadaAt: new Date().toISOString() };
  entries.push(entry); // TODO: http.post('/triaje', input)
  return { ...entry };
}
