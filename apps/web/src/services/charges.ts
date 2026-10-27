import { http } from '../shared/http';

export interface Charge {
  id: string;
  turnoId: string;
  importePesos: number;
  tipoAtencion: 'REGULAR' | 'URGENCIA';
  createdAt: string;
}

export function listCharges(): Promise<Charge[]> {
  return http.get<Charge[]>('/billing/cargos');
}