import { HOSPITAL_TIME_ZONE } from './dias-cama.js';

export const BOM_UTF8 = '\uFEFF';
export const FIN_DE_LINEA_CSV = '\r\n';

export const COLUMNAS_CSV_CARGOS = [
  'id',
  'fecha',
  'tipoAtencion',
  'estado',
  'concepto',
  'importePesos',
  'pacientePesos',
  'terceroPesos',
  'cobertura',
  'paciente',
  'medico',
] as const;

export type CampoCsv = string | number | null | undefined;

export interface CargoParaCsv {
  id: string;
  createdAt: Date;
  tipoAtencion: string;
  estado: string;
  concepto: string | null;
  importePesos: number;
  cobertura: {
    tipo: string;
    pacientePesos: number | null;
    terceroPesos: number | null;
  } | null;
  paciente: { nombre: string; apellido: string } | null;
  turno: {
    medico: { nombre: string; apellido: string };
  } | null;
}

const INICIO_DE_FORMULA = /^[=+\-@\t]/;
const REQUIERE_COMILLAS = /[",\r\n]/;

export function escaparCampoCsv(valor: CampoCsv): string {
  if (valor === null || valor === undefined) {
    return '';
  }
  if (typeof valor === 'number') {
    return String(valor);
  }
  const seguro = INICIO_DE_FORMULA.test(valor) ? `'${valor}` : valor;
  return REQUIERE_COMILLAS.test(seguro) ? `"${seguro.replaceAll('"', '""')}"` : seguro;
}

export function filaCsv(campos: readonly CampoCsv[]): string {
  return campos.map(escaparCampoCsv).join(',') + FIN_DE_LINEA_CSV;
}

export function cabeceraCsvCargos(): string {
  return BOM_UTF8 + filaCsv(COLUMNAS_CSV_CARGOS);
}

export function filaCsvCargo(cargo: CargoParaCsv): string {
  const paciente = cargo.paciente;
  const medico = cargo.turno?.medico;
  return filaCsv([
    cargo.id,
    cargo.createdAt.toISOString(),
    cargo.tipoAtencion,
    cargo.estado,
    cargo.concepto,
    cargo.importePesos,
    cargo.cobertura?.pacientePesos,
    cargo.cobertura?.terceroPesos,
    cargo.cobertura?.tipo,
    paciente ? `${paciente.nombre} ${paciente.apellido}` : null,
    medico ? `${medico.nombre} ${medico.apellido}` : null,
  ]);
}

const formatoDia = new Intl.DateTimeFormat('en-CA', {
  timeZone: HOSPITAL_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

export function nombreArchivoCargos(ahora: Date): string {
  return `cargos-${formatoDia.format(ahora)}.csv`;
}
