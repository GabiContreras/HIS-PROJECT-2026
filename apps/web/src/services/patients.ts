import { http } from '../shared/http';

export interface Patient {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono: string | null;
}

export interface CreatePatientInput {
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string;
}

/** Busca por nombre, apellido o documento (el back devuelve hasta 50). Sin texto lista los primeros. */
export function searchPatients(q = ''): Promise<Patient[]> {
  const text = q.trim();
  return http.get<Patient[]>(`/pacientes${text ? `?q=${encodeURIComponent(text)}` : ''}`);
}

export function getPatient(id: string): Promise<Patient> {
  return http.get<Patient>(`/pacientes/${id}`);
}

export function createPatient(input: CreatePatientInput): Promise<Patient> {
  return http.post<Patient>('/pacientes', input);
}
