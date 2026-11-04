/** Tipos permitidos; coinciden con el CHECK ck_signos_tipo de la tabla signos_vitales. */
export enum TipoSignoVital {
  PRESION_ARTERIAL = 'PRESION_ARTERIAL',
  PRESION_DIASTOLICA = 'PRESION_DIASTOLICA',
  TEMPERATURA = 'TEMPERATURA',
  FRECUENCIA_CARDIACA = 'FRECUENCIA_CARDIACA',
  FRECUENCIA_RESPIRATORIA = 'FRECUENCIA_RESPIRATORIA',
  SATURACION_O2 = 'SATURACION_O2',
}

/** HU 1.1: por encima de esta temperatura el control es crítico y se alerta al médico. */
export const TEMPERATURA_CRITICA_C = 39;

interface VitalSignRule {
  unidad: string;
  /** Nombre para mostrar en notas y alertas. */
  etiqueta: string;
  /** Límites de plausibilidad: fuera de ellos el dato se rechaza por error de carga. */
  minPlausible: number;
  maxPlausible: number;
  /** Rango normal: fuera de él el registro se marca como alerta. */
  minNormal: number;
  maxNormal: number;
}

export const VITAL_SIGN_RULES: Record<TipoSignoVital, VitalSignRule> = {
  // PRESION_ARTERIAL es la presión sistólica; la diastólica va como tipo aparte (la tabla guarda un único valor numérico).
  [TipoSignoVital.PRESION_ARTERIAL]: { etiqueta: 'Presión sistólica', unidad: 'mmHg', minPlausible: 40, maxPlausible: 300, minNormal: 90, maxNormal: 140 },
  // HU 1.1: más de 39 °C genera alerta de alta prioridad.
  [TipoSignoVital.PRESION_DIASTOLICA]: { etiqueta: 'Presión diastólica', unidad: 'mmHg', minPlausible: 20, maxPlausible: 200, minNormal: 60, maxNormal: 90 },
  [TipoSignoVital.TEMPERATURA]: { etiqueta: 'Temperatura', unidad: '°C', minPlausible: 25, maxPlausible: 45, minNormal: 35, maxNormal: TEMPERATURA_CRITICA_C },
  [TipoSignoVital.FRECUENCIA_CARDIACA]: { etiqueta: 'Frecuencia cardíaca', unidad: 'lpm', minPlausible: 20, maxPlausible: 250, minNormal: 50, maxNormal: 120 },
  [TipoSignoVital.FRECUENCIA_RESPIRATORIA]: { etiqueta: 'Frecuencia respiratoria', unidad: 'rpm', minPlausible: 4, maxPlausible: 80, minNormal: 10, maxNormal: 25 },
  [TipoSignoVital.SATURACION_O2]: { etiqueta: 'Saturación de O₂', unidad: '%', minPlausible: 50, maxPlausible: 100, minNormal: 92, maxNormal: 100 },
};

export function unidadDe(tipo: TipoSignoVital): string {
  return VITAL_SIGN_RULES[tipo].unidad;
}

export function esValorPlausible(tipo: TipoSignoVital, valor: number): boolean {
  const rule = VITAL_SIGN_RULES[tipo];
  return Number.isFinite(valor) && valor >= rule.minPlausible && valor <= rule.maxPlausible;
}

export function estaFueraDeRango(tipo: TipoSignoVital, valor: number): boolean {
  const rule = VITAL_SIGN_RULES[tipo];
  return valor < rule.minNormal || valor > rule.maxNormal;
}

/** Valores que componen un control completo (HU 1.1) y el tipo con el que se guarda cada uno. */
export const CAMPOS_CONTROL = {
  sistolica: TipoSignoVital.PRESION_ARTERIAL,
  diastolica: TipoSignoVital.PRESION_DIASTOLICA,
  frecuenciaCardiaca: TipoSignoVital.FRECUENCIA_CARDIACA,
  temperatura: TipoSignoVital.TEMPERATURA,
} as const;

export type CampoControl = keyof typeof CAMPOS_CONTROL;
