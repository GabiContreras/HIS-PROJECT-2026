import { http } from '../shared/http';

export type DoseStatus = 'PENDIENTE' | 'ADMINISTRADA';

export interface Dose {
  programadaPara: string; // ISO
  estado: DoseStatus;
  /** True si la hora actual cae dentro de la ventana de ±30 min de la dosis. */
  enVentana: boolean;
  administradaPor?: string;
  administradaEn?: string;
}

export interface Indication {
  id: string;
  pacienteId: string;
  paciente: string;
  insumoId: string;
  insumo: string;
  dosis: string;
  frecuencia: string;
  frecuenciaHoras: number | null;
  fechaInicio: string;
  fechaFin: string | null;
  dosisDelDia: Dose[];
}

export interface Administration {
  id: string;
  indicacionId: string;
  pacienteId: string;
  insumoId: string;
  dosisProgramadaPara: string;
  administradaPor: string;
  administradaPorId: string;
  administradaEn: string;
  observaciones: string | null;
}

export function listIndications(pacienteId?: string): Promise<Indication[]> {
  return http.get<Indication[]>(
    pacienteId ? `/indicaciones?pacienteId=${encodeURIComponent(pacienteId)}` : '/indicaciones',
  );
}

/** Registra la administración de la dosis vigente (solo ENFERMERO). 409 si ya se administró o está fuera de ventana. */
export function administerDose(indicationId: string, observaciones?: string): Promise<Administration> {
  return http.post<Administration>(
    `/indicaciones/${encodeURIComponent(indicationId)}/administraciones`,
    observaciones ? { observaciones } : {},
  );
}
