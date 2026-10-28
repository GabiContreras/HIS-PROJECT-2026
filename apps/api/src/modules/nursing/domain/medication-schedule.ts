/**
 * Reglas puras de planificación de medicación (sin Nest ni TypeORM).
 *
 * Una indicación con frecuencia de N horas programa dosis en
 * `fechaInicio + k * N horas` (k = 0, 1, 2...), mientras la dosis sea anterior a `fechaFin`.
 * Una dosis puede administrarse dentro de ±30 minutos de su hora programada.
 */

export const VENTANA_MINUTOS = 30;
const MINUTO_MS = 60_000;
const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
/** Argentina no tiene horario de verano: el día calendario del hospital es UTC-3 fijo. */
const OFFSET_HOSPITAL_MS = -3 * HORA_MS;

export interface IndicacionPlan {
  fechaInicio: Date;
  fechaFin: Date | null;
  /** Null en indicaciones anteriores a la migración de frecuencia estructurada. */
  frecuenciaHoras: number | null;
}

export type MotivoRechazo = 'SIN_FRECUENCIA' | 'NO_INICIADA' | 'VENCIDA' | 'FUERA_DE_VENTANA';

export type EvaluacionDosis =
  | { ok: true; indice: number; programadaPara: Date }
  | { ok: false; motivo: MotivoRechazo };

export interface DosisProgramada {
  indice: number;
  programadaPara: Date;
}

/** Texto legible que se guarda en la columna `frecuencia` (ej. "cada 8 horas"). */
export function textoFrecuencia(frecuenciaHoras: number): string {
  return frecuenciaHoras === 1 ? 'cada 1 hora' : `cada ${frecuenciaHoras} horas`;
}

export function horaDosis(plan: IndicacionPlan, indice: number): Date {
  return new Date(plan.fechaInicio.getTime() + indice * (plan.frecuenciaHoras ?? 0) * HORA_MS);
}

/** Una indicación está activa desde su inicio hasta (sin incluir) su fecha de fin. */
export function estaActiva(plan: IndicacionPlan, ahora: Date): boolean {
  if (ahora < plan.fechaInicio) return false;
  return plan.fechaFin === null || ahora < plan.fechaFin;
}

/**
 * Índice de la dosis programada más cercana a `instante` (nunca menor que 0).
 * En un empate exacto (a mitad de camino entre dos dosis) gana la anterior.
 */
export function indiceDosisMasCercana(plan: IndicacionPlan, instante: Date): number {
  const frecuenciaMs = (plan.frecuenciaHoras ?? 0) * HORA_MS;
  if (frecuenciaMs <= 0) return 0;
  const diff = instante.getTime() - plan.fechaInicio.getTime();
  return Math.max(0, Math.ceil((2 * diff - frecuenciaMs) / (2 * frecuenciaMs)));
}

/** Valida si `ahora` permite administrar una dosis y cuál sería. */
export function evaluarAdministracion(plan: IndicacionPlan, ahora: Date): EvaluacionDosis {
  if (plan.frecuenciaHoras === null || plan.frecuenciaHoras <= 0) {
    return { ok: false, motivo: 'SIN_FRECUENCIA' };
  }
  if (ahora < plan.fechaInicio) return { ok: false, motivo: 'NO_INICIADA' };
  if (plan.fechaFin !== null && ahora >= plan.fechaFin) return { ok: false, motivo: 'VENCIDA' };

  const indice = indiceDosisMasCercana(plan, ahora);
  const programadaPara = horaDosis(plan, indice);
  if (plan.fechaFin !== null && programadaPara >= plan.fechaFin) {
    return { ok: false, motivo: 'FUERA_DE_VENTANA' };
  }
  const distancia = Math.abs(ahora.getTime() - programadaPara.getTime());
  if (distancia > VENTANA_MINUTOS * MINUTO_MS) return { ok: false, motivo: 'FUERA_DE_VENTANA' };
  return { ok: true, indice, programadaPara };
}

/**
 * Índice de dosis al que corresponde una administración ya registrada, o null si
 * no cae dentro de la ventana de ninguna dosis (dato inconsistente: se ignora).
 */
export function indiceDeAdministracion(plan: IndicacionPlan, administradaEn: Date): number | null {
  if (plan.frecuenciaHoras === null || plan.frecuenciaHoras <= 0) return null;
  const indice = indiceDosisMasCercana(plan, administradaEn);
  const distancia = Math.abs(administradaEn.getTime() - horaDosis(plan, indice).getTime());
  return distancia <= VENTANA_MINUTOS * MINUTO_MS ? indice : null;
}

/** True si alguna administración registrada ya cubre la dosis `indice`. */
export function dosisYaAdministrada(
  plan: IndicacionPlan,
  indice: number,
  administraciones: readonly Date[],
): boolean {
  return administraciones.some((fecha) => indiceDeAdministracion(plan, fecha) === indice);
}

/** Inicio (00:00 hora del hospital) del día calendario que contiene `instante`. */
export function inicioDelDia(instante: Date): Date {
  const local = instante.getTime() + OFFSET_HOSPITAL_MS;
  return new Date(Math.floor(local / DIA_MS) * DIA_MS - OFFSET_HOSPITAL_MS);
}

/** Dosis programadas dentro de [desde, hasta), respetando inicio y fin de la indicación. */
export function dosisEnRango(plan: IndicacionPlan, desde: Date, hasta: Date): DosisProgramada[] {
  if (plan.frecuenciaHoras === null || plan.frecuenciaHoras <= 0) return [];
  const frecuenciaMs = plan.frecuenciaHoras * HORA_MS;
  const primerIndice = Math.max(
    0,
    Math.ceil((Math.max(desde.getTime(), plan.fechaInicio.getTime()) - plan.fechaInicio.getTime()) / frecuenciaMs),
  );
  const resultado: DosisProgramada[] = [];
  for (let indice = primerIndice; ; indice++) {
    const programadaPara = horaDosis(plan, indice);
    if (programadaPara >= hasta) break;
    if (plan.fechaFin !== null && programadaPara >= plan.fechaFin) break;
    resultado.push({ indice, programadaPara });
  }
  return resultado;
}
