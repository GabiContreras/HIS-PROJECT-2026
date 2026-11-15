import { http } from '../shared/http';

export type TipoAtencionFacturable = 'REGULAR' | 'URGENCIA' | 'FARMACIA' | 'INTERNACION';

export type AgrupacionPeriodo = 'dia' | 'mes';

export interface ReportPeriod {
  desde: string;
  hasta: string;
}

export interface ChargeAmounts {
  cantidad: number;
  totalPesos: number;
  pacientePesos: number;
  terceroPesos: number;
}

export interface CancelledCharges {
  cantidad: number;
  totalPesos: number;
}

export interface ChargesReport<Row> extends ReportPeriod {
  totales: ChargeAmounts;
  anulados: CancelledCharges;
  filas: Row[];
}

export interface ChargesByPeriodRow extends ChargeAmounts {
  periodo: string;
}

export interface ChargesByPeriodReport extends ChargesReport<ChargesByPeriodRow> {
  agrupacion: AgrupacionPeriodo;
}

export interface ChargesByDoctorRow extends ChargeAmounts {
  medicoId: string | null;
  medico: string;
}

export interface ChargesByServiceRow extends ChargeAmounts {
  tipoAtencion: TipoAtencionFacturable;
}

export interface BedOccupancyReport {
  camasActivas: number;
  camasOcupadas: number;
  porcentajeOcupacion: number;
}

export interface SupplyConsumptionRow {
  insumoId: string;
  nombre: string;
  unidadMedida: string;
  cantidadTotal: number;
  cantidadManual: number;
  cantidadMedicacion: number;
}

export interface SupplyConsumptionReport extends ReportPeriod {
  filas: SupplyConsumptionRow[];
}

function periodQuery(period: ReportPeriod, agrupacion?: AgrupacionPeriodo): string {
  const params = new URLSearchParams({ desde: period.desde, hasta: period.hasta });
  if (agrupacion) params.set('agrupacion', agrupacion);
  return params.toString();
}

export function getChargesByPeriod(
  period: ReportPeriod,
  agrupacion?: AgrupacionPeriodo,
): Promise<ChargesByPeriodReport> {
  return http.get<ChargesByPeriodReport>(
    `/billing/reportes/cargos-por-periodo?${periodQuery(period, agrupacion)}`,
  );
}

export function getChargesByDoctor(period: ReportPeriod): Promise<ChargesReport<ChargesByDoctorRow>> {
  return http.get<ChargesReport<ChargesByDoctorRow>>(
    `/billing/reportes/cargos-por-medico?${periodQuery(period)}`,
  );
}

export function getChargesByService(period: ReportPeriod): Promise<ChargesReport<ChargesByServiceRow>> {
  return http.get<ChargesReport<ChargesByServiceRow>>(
    `/billing/reportes/cargos-por-servicio?${periodQuery(period)}`,
  );
}

export function getBedOccupancy(): Promise<BedOccupancyReport> {
  return http.get<BedOccupancyReport>('/billing/reportes/ocupacion-camas');
}

export function getSupplyConsumption(period: ReportPeriod): Promise<SupplyConsumptionReport> {
  return http.get<SupplyConsumptionReport>(`/billing/reportes/consumo-insumos?${periodQuery(period)}`);
}
