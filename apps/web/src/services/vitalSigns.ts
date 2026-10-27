export interface VitalSign {
  id: string;
  paciente: string;
  tipo: string;
  valor: number;
  unidad: string;
  fechaHora: string; // ISO
}

export interface VitalType {
  tipo: string;
  unidad: string;
  min: number;
  max: number;
}

export const VITAL_TYPES: VitalType[] = [
  { tipo: 'Frecuencia cardíaca', unidad: 'lpm', min: 30, max: 220 },
  { tipo: 'Temperatura', unidad: '°C', min: 30, max: 45 },
  { tipo: 'Saturación O₂', unidad: '%', min: 50, max: 100 },
  { tipo: 'Presión sistólica', unidad: 'mmHg', min: 60, max: 250 },
];

function minutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

// Estado en memoria mientras no exista el endpoint
const records: VitalSign[] = [
  { id: '1', paciente: 'Marta Pérez', tipo: 'Frecuencia cardíaca', valor: 78, unidad: 'lpm', fechaHora: minutesAgo(12) },
  { id: '2', paciente: 'Luis Rossi', tipo: 'Temperatura', valor: 37.8, unidad: '°C', fechaHora: minutesAgo(35) },
  { id: '3', paciente: 'Ana Díaz', tipo: 'Saturación O₂', valor: 96, unidad: '%', fechaHora: minutesAgo(50) },
];

export async function listVitalSigns(): Promise<VitalSign[]> {
  return [...records]; // TODO: http.get<VitalSign[]>('/signos-vitales')
}

export async function addVitalSign(input: Omit<VitalSign, 'id' | 'fechaHora'>): Promise<VitalSign> {
  const record: VitalSign = { ...input, id: crypto.randomUUID(), fechaHora: new Date().toISOString() };
  records.unshift(record); // TODO: http.post('/signos-vitales', input)
  return record;
}