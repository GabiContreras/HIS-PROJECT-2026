import { http } from '../shared/http';
import type { Patient } from './patients';

export type ClinicalSectionKey = 'alergias' | 'antecedentesFamiliares' | 'evoluciones' | 'estudios';
export type ClinicalRecordCategory =
  | 'ALERGIA'
  | 'ANTECEDENTE_FAMILIAR'
  | 'EVOLUCION'
  | 'ESTUDIO'
  | 'NOTA_ENFERMERIA'
  | 'RECTIFICACION';

export interface ClinicalRecord {
  id: string;
  categoria: ClinicalRecordCategory;
  titulo: string | null;
  detalle: string;
  registradoPor: string;
  fechaHora: string; // ISO
  corrigeA: string | null;
  rectificado: boolean;
  turnoId: string | null;
  internacionId: string | null;
}

export interface ClinicalHistory {
  paciente: Patient;
  alergias: ClinicalRecord[];
  antecedentesFamiliares: ClinicalRecord[];
  evoluciones: ClinicalRecord[];
  estudios: ClinicalRecord[];
  notasEnfermeria: ClinicalRecord[];
  rectificaciones: ClinicalRecord[];
}

export interface ClinicalTimelineItem {
  id: string;
  tipo: string;
  fechaHora: string;
  titulo: string;
  detalle: string;
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

export function getClinicalTimeline(pacienteId: string): Promise<ClinicalTimelineItem[]> {
  return http.get<ClinicalTimelineItem[]>(
    `/historia-clinica/${encodeURIComponent(pacienteId)}/timeline`,
  );
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
