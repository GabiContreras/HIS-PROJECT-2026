import { http } from '../shared/http';
import type { TipoAtencionFacturable } from './reports';

export interface Liquidation {
  id: string;
  financiadorId: string;
  financiadorNombre: string;
  desde: string;
  hasta: string;
  cantidadCargos: number;
  totalPesos: number;
  usuarioId: string | null;
  createdAt: string;
}

export interface LiquidationCharge {
  id: string;
  concepto: string | null;
  tipoAtencion: TipoAtencionFacturable;
  createdAt: string;
  importePesos: number;
  importeTerceroPesos: number | null;
}

export interface LiquidationDetail extends Liquidation {
  cargos: LiquidationCharge[];
}

export interface LiquidationsPage {
  items: Liquidation[];
  total: number;
  limit: number;
  offset: number;
}

export interface CreateLiquidationInput {
  financiadorId: string;
  desde: string;
  hasta: string;
}

export interface LiquidationFilters {
  financiadorId?: string;
  limit?: number;
  offset?: number;
}

function liquidationsQuery(filters: LiquidationFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function createLiquidation(input: CreateLiquidationInput): Promise<Liquidation> {
  return http.post<Liquidation>('/billing/liquidaciones', input);
}

export function listLiquidations(filters: LiquidationFilters = {}): Promise<LiquidationsPage> {
  return http.get<LiquidationsPage>(`/billing/liquidaciones${liquidationsQuery(filters)}`);
}

export function getLiquidation(id: string): Promise<LiquidationDetail> {
  return http.get<LiquidationDetail>(`/billing/liquidaciones/${id}`);
}
