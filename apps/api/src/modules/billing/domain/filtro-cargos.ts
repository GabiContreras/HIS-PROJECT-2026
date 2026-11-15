import { EstadoCargo } from './estado-cargo.js';
import { armarRango } from './periodo-reporte.js';
import { TipoAtencionFacturable } from './tipo-atencion-facturable.js';

export const LIMITE_POR_DEFECTO = 50;
export const LIMITE_MAXIMO = 100;
export const OFFSET_POR_DEFECTO = 0;

export interface FiltroCargosEntrada {
  desde?: string;
  hasta?: string;
  pacienteId?: string;
  estado?: EstadoCargo;
  tipoAtencion?: TipoAtencionFacturable;
}

export interface FiltroCargos {
  inicio: Date | null;
  finExclusivo: Date | null;
  pacienteId: string | null;
  estado: EstadoCargo | null;
  tipoAtencion: TipoAtencionFacturable | null;
}

export function armarFiltroCargos(entrada: FiltroCargosEntrada): FiltroCargos {
  const { inicio, finExclusivo } = armarRango(entrada.desde, entrada.hasta);
  return {
    inicio,
    finExclusivo,
    pacienteId: entrada.pacienteId ?? null,
    estado: entrada.estado ?? null,
    tipoAtencion: entrada.tipoAtencion ?? null,
  };
}
