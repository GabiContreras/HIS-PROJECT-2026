import { http } from '../shared/http';

export type TipoCobertura = 'OBRA_SOCIAL_PUBLICA' | 'MEDICINA_PREPAGA' | 'PARTICULAR';

export interface Patient {
  id: string;
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono: string | null;
  tipoCobertura: TipoCobertura;
  entidadCobertura: string | null;
}

export interface CreatePatientInput {
  nombre: string;
  apellido: string;
  documento: string;
  fechaNacimiento: string;
  telefono?: string;
  tipoCobertura: TipoCobertura;
  entidadCobertura?: string;
}

export interface CoberturaInput {
  tipoCobertura: TipoCobertura;
  entidadCobertura?: string;
}

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

export function actualizarCobertura(id: string, input: CoberturaInput): Promise<Patient> {
  return http.patch<Patient>(`/pacientes/${id}/cobertura`, input);
}
