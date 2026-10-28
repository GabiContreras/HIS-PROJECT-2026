import { http } from '../shared/http';

export interface Patient {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono: string | null;
}

const MOCK: Patient[] = [
  { id: '1', nombre: 'Marta', apellido: 'Pérez', documento: '20111222', fechaNacimiento: '1958-03-12', telefono: null },
  { id: '2', nombre: 'Luis', apellido: 'Rossi', documento: '27333444', fechaNacimiento: '1985-07-30', telefono: '3511234567' },
  { id: '3', nombre: 'Ana', apellido: 'Díaz', documento: '30555666', fechaNacimiento: '1992-11-02', telefono: null },
];

export async function listPatients(): Promise<Patient[]> {
  return MOCK; // TODO: http.get<Patient[]>('/pacientes') cuando exista el endpoint
}

export interface CrearPacienteInput {
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string;
}

export function searchPatients(q = ''): Promise<Patient[]> {
  const term = q.trim();
  return http.get<Patient[]>(term ? `/pacientes?q=${encodeURIComponent(term)}` : '/pacientes');
}

export function createPatient(datos: CrearPacienteInput): Promise<Patient> {
  return http.post<Patient>('/pacientes', datos);
}
