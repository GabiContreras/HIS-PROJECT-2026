import { http } from '../shared/http';
import type { Patient } from './patients';

export type ClinicalSectionKey = 'alergias' | 'antecedentesFamiliares' | 'evoluciones' | 'estudios';

export interface ClinicalRecord {
  id: string;
  categoria: 'ALERGIA' | 'ANTECEDENTE_FAMILIAR' | 'EVOLUCION' | 'ESTUDIO';
  titulo: string | null;
  detalle: string;
  registradoPor: string;
  fechaHora: string; // ISO
}

export interface ClinicalHistory extends Record<ClinicalSectionKey, ClinicalRecord[]> {
  paciente: Patient;
}

/** Cada sección de la historia: ruta de alta y nombre de los campos que espera la API. */
export interface ClinicalSection {
  key: ClinicalSectionKey;
  title: string;
  path: string;
  titleField: string | null;
  titleLabel: string;
  detailField: string;
  detailLabel: string;
  empty: string;
}

export const CLINICAL_SECTIONS: ClinicalSection[] = [
  { key: 'alergias', title: 'Alergias', path: 'alergias', titleField: 'sustancia', titleLabel: 'Sustancia', detailField: 'reaccion', detailLabel: 'Reacción', empty: 'No hay alergias registradas.' },
  { key: 'antecedentesFamiliares', title: 'Antecedentes familiares', path: 'antecedentes-familiares', titleField: 'parentesco', titleLabel: 'Parentesco', detailField: 'descripcion', detailLabel: 'Antecedente', empty: 'No hay antecedentes familiares registrados.' },
  { key: 'evoluciones', title: 'Evoluciones médicas', path: 'evoluciones', titleField: null, titleLabel: '', detailField: 'nota', detailLabel: 'Nota de evolución', empty: 'No hay evoluciones registradas.' },
  { key: 'estudios', title: 'Estudios', path: 'estudios', titleField: 'tipo', titleLabel: 'Tipo de estudio', detailField: 'resultado', detailLabel: 'Resultado', empty: 'No hay estudios registrados.' },
];

export function getClinicalHistory(pacienteId: string): Promise<ClinicalHistory> {
  return http.get<ClinicalHistory>(`/historia-clinica/${encodeURIComponent(pacienteId)}`);
}

export function addClinicalRecord(
  pacienteId: string,
  section: ClinicalSection,
  titulo: string,
  detalle: string,
): Promise<ClinicalRecord> {
  const body: Record<string, string> = { [section.detailField]: detalle };
  if (section.titleField) body[section.titleField] = titulo;
  return http.post<ClinicalRecord>(`/historia-clinica/${encodeURIComponent(pacienteId)}/${section.path}`, body);
}
