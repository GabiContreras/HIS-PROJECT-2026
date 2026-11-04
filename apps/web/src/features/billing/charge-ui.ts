import type { Charge, TipoAtencion } from '../../services/charges';
import type { TipoCobertura } from '../../services/patients';

export const CONCEPTO: Record<TipoAtencion, string> = {
  REGULAR: 'Consulta médica general',
  URGENCIA: 'Consulta de urgencia (entreturno)',
};

export const TIPO_LABEL: Record<TipoAtencion, string> = {
  REGULAR: 'Prestación médica',
  URGENCIA: 'Urgencia',
};

export const COBERTURA_LABEL: Record<TipoCobertura, string> = {
  OBRA_SOCIAL_PUBLICA: 'Obra social pública',
  MEDICINA_PREPAGA: 'Medicina prepaga',
  PARTICULAR: 'Particular',
};

/** "Medicina Prepaga Premium", "Obra social pública", "Particular" o "No registrada" en cargos viejos. */
export function coverageLabel(charge: Charge): string {
  const c = charge.cobertura;
  if (!c) return 'No registrada';
  return c.entidad ?? COBERTURA_LABEL[c.tipo];
}

/** Cargos con obra social pública o prepaga: los que no pagan el 100% a cargo del paciente. */
export const hasCoverage = (charge: Charge): boolean =>
  charge.cobertura?.tipo === 'OBRA_SOCIAL_PUBLICA' || charge.cobertura?.tipo === 'MEDICINA_PREPAGA';

/** Nombre de quien recibe el reclamo por la parte que no paga el paciente. */
export function thirdPartyLabel(charge: Charge): string {
  const c = charge.cobertura;
  if (!c) return 'Tercero';
  return c.tipo === 'OBRA_SOCIAL_PUBLICA' ? (c.entidad ?? 'el Estado') : (c.entidad ?? 'la prepaga');
}

export function patientName(charge: Charge): string {
  const p = charge.turno?.paciente;
  return p ? `${p.nombre} ${p.apellido}` : 'Paciente no disponible';
}

export function doctorName(charge: Charge): string {
  const m = charge.turno?.medico;
  return m ? `${m.nombre} ${m.apellido}` : 'No disponible';
}

export function initials(charge: Charge): string {
  const p = charge.turno?.paciente;
  return p ? `${p.nombre[0] ?? ''}${p.apellido[0] ?? ''}`.toUpperCase() : '?';
}

/** Id corto para mostrar en tablas (los uuid completos se ven en el detalle). */
export const shortId = (id: string): string => id.slice(0, 8);

export type Periodo = 'TODO' | 'HOY' | 'SEMANA' | 'MES';

export const PERIODO_LABEL: Record<Periodo, string> = {
  TODO: 'Todo el historial',
  HOY: 'Hoy',
  SEMANA: 'Últimos 7 días',
  MES: 'Este mes',
};

export function inPeriod(iso: string, periodo: Periodo, now = new Date()): boolean {
  const date = new Date(iso);
  switch (periodo) {
    case 'HOY':
      return date.toDateString() === now.toDateString();
    case 'SEMANA':
      return now.getTime() - date.getTime() <= 7 * 24 * 60 * 60_000;
    case 'MES':
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    default:
      return true;
  }
}

const csvCell = (value: string | number): string => `"${String(value).replace(/"/g, '""')}"`;

/** CSV para Excel en español: separador ';' y BOM para que respete los acentos. */
export function buildChargesCsv(charges: Charge[]): string {
  const header = [
    'Fecha del cargo', 'Paciente', 'Documento', 'Médico', 'Concepto', 'Tipo de cargo',
    'Fecha de atención', 'Cobertura', 'Valor base (ARS)', 'A cargo del paciente (ARS)',
    'A cargo de terceros (ARS)', 'ID del cargo', 'ID del turno',
  ];
  const lines = charges.map((c) => [
    new Date(c.createdAt).toLocaleString('es-AR'),
    patientName(c),
    c.turno?.paciente?.documento ?? '',
    doctorName(c),
    CONCEPTO[c.tipoAtencion],
    TIPO_LABEL[c.tipoAtencion],
    c.turno ? new Date(c.turno.fechaHora).toLocaleString('es-AR') : '',
    coverageLabel(c),
    c.importePesos,
    c.cobertura?.pacientePesos ?? '',
    c.cobertura?.terceroPesos ?? '',
    c.id,
    c.turnoId,
  ]);
  return `\uFEFF${[header, ...lines].map((row) => row.map(csvCell).join(';')).join('\r\n')}`;
}

export function downloadCsv(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
