import { http } from '../shared/http';
import type { TipoCobertura } from './patients';

export type TipoAtencion = 'REGULAR' | 'URGENCIA';

export interface Charge {
  id: string;
  turnoId: string;
  importePesos: number;
  tipoAtencion: TipoAtencion;
  createdAt: string;
  /** Cobertura del paciente al facturar y cómo se repartió el valor base. null en cargos anteriores al registro de coberturas. */
  cobertura: {
    tipo: TipoCobertura;
    entidad: string | null;
    /** Lo que paga el paciente. */
    pacientePesos: number | null;
    /** Lo que se le reclama al Estado o a la prepaga. */
    terceroPesos: number | null;
  } | null;
  /** null si el turno que originó el cargo ya no se puede leer. */
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
