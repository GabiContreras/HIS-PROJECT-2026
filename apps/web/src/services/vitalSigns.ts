import { http } from '../shared/http';

export type TipoSignoVital =
  | 'PRESION_ARTERIAL'
  | 'TEMPERATURA'
  | 'FRECUENCIA_CARDIACA'
  | 'FRECUENCIA_RESPIRATORIA'
  | 'SATURACION_O2';

/** Etiquetas de pantalla para cada código de la API. */
export const VITAL_TYPE_LABELS: Record<TipoSignoVital, string> = {
  PRESION_ARTERIAL: 'Presión arterial (sistólica)',
  TEMPERATURA: 'Temperatura',
  FRECUENCIA_CARDIACA: 'Frecuencia cardíaca',
  FRECUENCIA_RESPIRATORIA: 'Frecuencia respiratoria',
  SATURACION_O2: 'Saturación O₂',
};

export const vitalTypeLabel = (tipo: string): string => VITAL_TYPE_LABELS[tipo as TipoSignoVital] ?? tipo;

export interface VitalType {
  tipo: TipoSignoVital;
  unidad: string;
  minPlausible: number;
  maxPlausible: number;
  minNormal: number;
  maxNormal: number;
}

export interface VitalSign {
  id: string;
  pacienteId: string;
  paciente: string;
  tipo: TipoSignoVital;
  valor: number;
  unidad: string;
  fechaHora: string; // ISO
  fueraDeRango: boolean;
}

export interface RegisterVitalSignInput {
  pacienteId: string;
  tipo: TipoSignoVital;
  valor: number;
}

export function listVitalTypes(): Promise<VitalType[]> {
  return http.get<VitalType[]>('/signos-vitales/tipos');
}

export function listVitalSigns(pacienteId?: string): Promise<VitalSign[]> {
  return http.get<VitalSign[]>(
    pacienteId ? `/signos-vitales?pacienteId=${encodeURIComponent(pacienteId)}` : '/signos-vitales',
  );
}

export function addVitalSign(input: RegisterVitalSignInput): Promise<VitalSign> {
  return http.post<VitalSign>('/signos-vitales', input);
}
