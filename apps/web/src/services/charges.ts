import { http } from '../shared/http';
import type { TipoCobertura } from './patients';

export type TipoAtencion = 'REGULAR' | 'URGENCIA';

export interface Charge {
  id: string;
  turnoId: string;
  importePesos: number;
  tipoAtencion: TipoAtencion;
  createdAt: string;
  cobertura: {
    tipo: TipoCobertura;
    entidad: string | null;
    pacientePesos: number | null;
    terceroPesos: number | null;
  } | null;
  turno: {
    fechaHora: string;
    duracionMinutos: number;
    urgente: boolean;
    medico: { id: string; nombre: string; apellido: string };
    paciente: { id: string; nombre: string; apellido: string; documento: string } | null;
  } | null;
}

export function listCharges(): Promise<Charge[]> {
  return http.get<Charge[]>('/billing/cargos');
}
