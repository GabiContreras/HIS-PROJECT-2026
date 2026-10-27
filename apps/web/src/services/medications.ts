export type MedicationStatus = 'PENDIENTE' | 'ADMINISTRADA';

export interface Medication {
  id: string;
  paciente: string;
  medicamento: string;
  dosis: string;
  horario: string; // HH:mm
  estado: MedicationStatus;
}

// Estado en memoria mientras no exista el endpoint
const records: Medication[] = [
  { id: '1', paciente: 'Marta Pérez', medicamento: 'Enalapril', dosis: '10 mg', horario: '08:00', estado: 'PENDIENTE' },
  { id: '2', paciente: 'Luis Rossi', medicamento: 'Paracetamol', dosis: '1 g', horario: '09:00', estado: 'PENDIENTE' },
  { id: '3', paciente: 'Ana Díaz', medicamento: 'Amoxicilina', dosis: '500 mg', horario: '10:30', estado: 'ADMINISTRADA' },
  { id: '4', paciente: 'Raúl Benítez', medicamento: 'Omeprazol', dosis: '20 mg', horario: '12:00', estado: 'PENDIENTE' },
];

export async function listMedications(): Promise<Medication[]> {
  return records.map((m) => ({ ...m })); // TODO: http.get('/medicaciones')
}

export async function markAdministered(id: string): Promise<void> {
  const record = records.find((m) => m.id === id);
  if (record) record.estado = 'ADMINISTRADA'; // TODO: http.patch(`/medicaciones/${id}/administrar`)
}