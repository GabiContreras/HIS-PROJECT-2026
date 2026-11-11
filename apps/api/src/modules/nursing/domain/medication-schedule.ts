export const VENTANA_MINUTOS = 30;
const MINUTO_MS = 60_000;
const HORA_MS = 3_600_000;
const DIA_MS = 24 * HORA_MS;
const OFFSET_HOSPITAL_MS = -3 * HORA_MS;

export interface IndicacionPlan {
  fechaInicio: Date;
  fechaFin: Date | null;
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

export function textoFrecuencia(frecuenciaHoras: number): string {
  return frecuenciaHoras === 1 ? 'cada 1 hora' : `cada ${frecuenciaHoras} horas`;
}

export function horaDosis(plan: IndicacionPlan, indice: number): Date {
  return new Date(plan.fechaInicio.getTime() + indice * (plan.frecuenciaHoras ?? 0) * HORA_MS);
}

export function estaActiva(plan: IndicacionPlan, ahora: Date): boolean {
  if (ahora < plan.fechaInicio) return false;
  return plan.fechaFin === null || ahora < plan.fechaFin;
}

export function indiceDosisMasCercana(plan: IndicacionPlan, instante: Date): number {
  const frecuenciaMs = (plan.frecuenciaHoras ?? 0) * HORA_MS;
  if (frecuenciaMs <= 0) return 0;
  const diff = instante.getTime() - plan.fechaInicio.getTime();
  return Math.max(0, Math.ceil((2 * diff - frecuenciaMs) / (2 * frecuenciaMs)));
}

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

export function indiceDeAdministracion(plan: IndicacionPlan, administradaEn: Date): number | null {
  if (plan.frecuenciaHoras === null || plan.frecuenciaHoras <= 0) return null;
  const indice = indiceDosisMasCercana(plan, administradaEn);
  const distancia = Math.abs(administradaEn.getTime() - horaDosis(plan, indice).getTime());
  return distancia <= VENTANA_MINUTOS * MINUTO_MS ? indice : null;
}

export function dosisYaAdministrada(
  plan: IndicacionPlan,
  indice: number,
  administraciones: readonly Date[],
): boolean {
  return administraciones.some((fecha) => indiceDeAdministracion(plan, fecha) === indice);
}

export function inicioDelDia(instante: Date): Date {
  const local = instante.getTime() + OFFSET_HOSPITAL_MS;
  return new Date(Math.floor(local / DIA_MS) * DIA_MS - OFFSET_HOSPITAL_MS);
}

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
