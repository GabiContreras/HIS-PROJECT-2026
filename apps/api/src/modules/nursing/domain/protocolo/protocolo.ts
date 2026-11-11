export enum TipoIngreso {
  PRE_QUIRURGICO = 'PRE_QUIRURGICO',
  RESPIRATORIO = 'RESPIRATORIO',
}

export interface TareaProtocolo {
  readonly orden: number;
  readonly descripcion: string;
  readonly frecuenciaHoras: number | null;
}

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
