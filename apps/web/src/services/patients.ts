import { http } from '../shared/http';

export interface Patient {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono: string | null;
}

export function listPatients(): Promise<Patient[]> {
  return http.get<Patient[]>('/pacientes');
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
