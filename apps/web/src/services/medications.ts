import { IBUPROFEN_ID } from './inventory';

export type MedicationStatus = 'PENDIENTE' | 'ADMINISTRADA';

export interface Medication {
  id: string;
  paciente: string;
  medicamento: string;
  dosis: string;
  indicacion: string;
  programadaAt: string; // ISO
  estado: MedicationStatus;
  /** Insumo del inventario que se descuenta al administrar (si corresponde). */
  insumoId: string | null;
  administradaPor: string | null;
  administradaAt: string | null;
}

/** Margen permitido para administrar respecto del horario indicado. */
export const ADMIN_WINDOW_MIN = 30;

const minutesFromNow = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

// Datos de prueba en memoria mientras no exista el endpoint de medicaciones.
const records: Medication[] = [
  { id: '1', paciente: 'Ana Rojas', medicamento: 'Ibuprofeno', dosis: '400 mg', indicacion: 'Cada 8 horas', programadaAt: minutesFromNow(-10), estado: 'PENDIENTE', insumoId: IBUPROFEN_ID, administradaPor: null, administradaAt: null },
  { id: '2', paciente: 'Marta Pérez', medicamento: 'Enalapril', dosis: '10 mg', indicacion: 'Cada 12 horas', programadaAt: minutesFromNow(20), estado: 'PENDIENTE', insumoId: null, administradaPor: null, administradaAt: null },
  { id: '3', paciente: 'Luis Rossi', medicamento: 'Paracetamol', dosis: '1 g', indicacion: 'Cada 6 horas', programadaAt: minutesFromNow(150), estado: 'PENDIENTE', insumoId: null, administradaPor: null, administradaAt: null },
  { id: '4', paciente: 'Carlos López', medicamento: 'Omeprazol', dosis: '20 mg', indicacion: 'Cada 24 horas', programadaAt: minutesFromNow(-180), estado: 'ADMINISTRADA', insumoId: null, administradaPor: 'Martín Torres', administradaAt: minutesFromNow(-175) },
];

export function minutesToSchedule(medication: Medication, now = new Date()): number {
  return Math.round((new Date(medication.programadaAt).getTime() - now.getTime()) / 60_000);
}

export function withinWindow(medication: Medication, now = new Date()): boolean {
  return Math.abs(minutesToSchedule(medication, now)) <= ADMIN_WINDOW_MIN;
}

export async function listMedications(): Promise<Medication[]> {
  return records.map((m) => ({ ...m })); // TODO: http.get<Medication[]>('/medicaciones')
}

export async function administerMedication(id: string, nurse: string): Promise<Medication> {
  const record = records.find((m) => m.id === id);
  if (!record) throw new Error('No se encontró la indicación.');
  if (record.estado === 'ADMINISTRADA') throw new Error('Esta dosis ya fue administrada.');
  if (!withinWindow(record)) {
    throw new Error(`Solo se puede administrar dentro de ±${ADMIN_WINDOW_MIN} minutos del horario indicado.`);
  }
  record.estado = 'ADMINISTRADA';
  record.administradaPor = nurse;
  record.administradaAt = new Date().toISOString();
  return { ...record }; // TODO: http.patch(`/medicaciones/${id}/administrar`)
}
