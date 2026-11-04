/**
 * Tipos de ingreso con protocolo de atención base (HU 2.1).
 * Extensión futura (no implementada): traumatismo de urgencia y observación pediátrica.
 */
export enum TipoIngreso {
  PRE_QUIRURGICO = 'PRE_QUIRURGICO',
  RESPIRATORIO = 'RESPIRATORIO',
}

/** Tarea inicial de enfermería. Inmutable. */
export interface TareaProtocolo {
  readonly orden: number;
  readonly descripcion: string;
  /** Cada cuántas horas se repite la tarea; null si es una tarea puntual o continua. */
  readonly frecuenciaHoras: number | null;
}

/**
 * Producto del patrón Builder: el plan de cuidados inicial de un ingreso.
 * Solo los builders lo crean (vía `Protocolo.crear`) y queda congelado.
 */
export class Protocolo {
  readonly tareas: readonly TareaProtocolo[];

  private constructor(
    readonly tipo: TipoIngreso,
    tareas: readonly TareaProtocolo[],
  ) {
    this.tareas = Object.freeze(tareas.map((t) => Object.freeze({ ...t })));
    Object.freeze(this);
  }

  static crear(tipo: TipoIngreso, tareas: readonly TareaProtocolo[]): Protocolo {
    if (tareas.length === 0) {
      throw new Error('Un protocolo debe tener al menos una tarea.');
    }
    return new Protocolo(tipo, tareas);
  }
}
