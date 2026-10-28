import { http } from '../shared/http';

export type TipoIngreso = 'PRE_QUIRURGICO' | 'RESPIRATORIO';

/** Etiquetas de pantalla para cada tipo de ingreso de la API. */
export const INGRESO_TYPE_LABELS: Record<TipoIngreso, string> = {
  PRE_QUIRURGICO: 'Ingreso pre-quirúrgico',
  RESPIRATORIO: 'Ingreso por infección respiratoria',
};

export const ingresoTypeLabel = (tipo: string): string => INGRESO_TYPE_LABELS[tipo as TipoIngreso] ?? tipo;

export interface ProtocolTask {
  orden: number;
  descripcion: string;
  frecuenciaHoras: number | null;
}

export interface Protocol {
  id: string;
  ingresoId: string;
  pacienteId: string;
  tipo: TipoIngreso;
  motivoIngreso: string;
  generadoEn: string; // ISO
  tareas: ProtocolTask[];
}

export function listProtocols(pacienteId: string): Promise<Protocol[]> {
  return http.get<Protocol[]>(`/protocolos?pacienteId=${encodeURIComponent(pacienteId)}`);
}
