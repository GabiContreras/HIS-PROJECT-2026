import { http, type Download } from '../shared/http';
import type { TipoCobertura } from './patients';

export type TipoAtencion = 'REGULAR' | 'URGENCIA' | 'INTERNACION';

export type EstadoCargo = 'PENDIENTE' | 'FACTURADO' | 'PAGADO' | 'ANULADO';

export interface Charge {
  id: string;
  turnoId: string;
  importePesos: number;
  tipoAtencion: TipoAtencion;
  estado: EstadoCargo;
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
  paciente: { id: string; nombre: string; apellido: string; documento: string } | null;
  /** null si el turno que originó el cargo ya no se puede leer. */
  turno: {
    fechaHora: string;
    duracionMinutos: number;
    urgente: boolean;
    medico: { id: string; nombre: string; apellido: string };
    paciente: { id: string; nombre: string; apellido: string; documento: string } | null;
  } | null;
}

export interface ChargesPage {
  items: Charge[];
  total: number;
  limit: number;
  offset: number;
}

export interface ChargeFilters {
  desde?: string;
  hasta?: string;
  pacienteId?: string;
  estado?: EstadoCargo;
  tipoAtencion?: TipoAtencion | 'FARMACIA';
  limit?: number;
  offset?: number;
}

export const CHARGES_PAGE_SIZE = 100;

function chargesQuery(filters: ChargeFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== undefined && value !== '') params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : '';
}

export function listChargesPage(filters: ChargeFilters = {}): Promise<ChargesPage> {
  return http.get<ChargesPage>(`/billing/cargos${chargesQuery(filters)}`);
}

export async function listCharges(): Promise<Charge[]> {
  const charges: Charge[] = [];
  let total = 0;
  do {
    const page = await listChargesPage({ limit: CHARGES_PAGE_SIZE, offset: charges.length });
    charges.push(...page.items);
    total = page.total;
    if (page.items.length === 0) break;
  } while (charges.length < total);
  return charges;
}

export type ChargeExportFilters = Omit<ChargeFilters, 'limit' | 'offset'>;

const EXPORT_FILENAME = 'cargos.csv';

function requestExport(filters: ChargeExportFilters): Promise<Download> {
  return http.download(`/billing/cargos/exportar${chargesQuery(filters)}`);
}

export async function exportCharges(filters: ChargeExportFilters = {}): Promise<Blob> {
  return (await requestExport(filters)).blob;
}

export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadCharges(filters: ChargeExportFilters = {}): Promise<void> {
  const { blob, filename } = await requestExport(filters);
  saveBlob(blob, filename ?? EXPORT_FILENAME);
}
