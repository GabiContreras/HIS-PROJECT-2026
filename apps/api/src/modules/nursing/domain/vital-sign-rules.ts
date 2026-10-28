/** Tipos permitidos; coinciden con el CHECK ck_signos_tipo de la tabla signos_vitales. */
export enum TipoSignoVital {
  PRESION_ARTERIAL = 'PRESION_ARTERIAL',
  TEMPERATURA = 'TEMPERATURA',
  FRECUENCIA_CARDIACA = 'FRECUENCIA_CARDIACA',
  FRECUENCIA_RESPIRATORIA = 'FRECUENCIA_RESPIRATORIA',
  SATURACION_O2 = 'SATURACION_O2',
}

interface VitalSignRule {
  unidad: string;
  /** Límites de plausibilidad: fuera de ellos el dato se rechaza por error de carga. */
  minPlausible: number;
  maxPlausible: number;
  /** Rango normal: fuera de él el registro se marca como alerta. */
  minNormal: number;
  maxNormal: number;
}

export const VITAL_SIGN_RULES: Record<TipoSignoVital, VitalSignRule> = {
  // Se registra la presión sistólica (la tabla guarda un único valor numérico).
  [TipoSignoVital.PRESION_ARTERIAL]: { unidad: 'mmHg', minPlausible: 40, maxPlausible: 300, minNormal: 90, maxNormal: 140 },
  // HU 1.1: más de 39 °C genera alerta de alta prioridad.
  [TipoSignoVital.TEMPERATURA]: { unidad: '°C', minPlausible: 25, maxPlausible: 45, minNormal: 35, maxNormal: 39 },
  [TipoSignoVital.FRECUENCIA_CARDIACA]: { unidad: 'lpm', minPlausible: 20, maxPlausible: 250, minNormal: 50, maxNormal: 120 },
  [TipoSignoVital.FRECUENCIA_RESPIRATORIA]: { unidad: 'rpm', minPlausible: 4, maxPlausible: 80, minNormal: 10, maxNormal: 25 },
  [TipoSignoVital.SATURACION_O2]: { unidad: '%', minPlausible: 50, maxPlausible: 100, minNormal: 92, maxNormal: 100 },
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
