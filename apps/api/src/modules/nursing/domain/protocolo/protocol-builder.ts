import { Protocolo, type TareaProtocolo, type TipoIngreso } from './protocolo.js';

/**
 * Interfaz Builder: pasos para ensamblar un protocolo de atención.
 * Cada Builder concreto sabe qué tareas componen su tipo de ingreso.
 */
export interface ProtocolBuilder {
  readonly tipo: TipoIngreso;
  /** Paso genérico: agrega una tarea al plan en construcción. */
  agregarTarea(descripcion: string, frecuenciaHoras?: number): this;
  /** Paso propio de cada tipo: agrega las tareas base de ese ingreso. */
  agregarTareasBase(): this;
  /** Entrega el producto terminado y reinicia el builder para poder reutilizarlo. */
  construir(): Protocolo;
}

/** Comportamiento común de los Builders concretos (acumulación de tareas y construcción). */
export abstract class BaseProtocolBuilder implements ProtocolBuilder {
  abstract readonly tipo: TipoIngreso;
  private tareas: TareaProtocolo[] = [];

  abstract agregarTareasBase(): this;

  agregarTarea(descripcion: string, frecuenciaHoras?: number): this {
    const texto = descripcion.trim();
    if (texto === '') throw new Error('La descripción de la tarea no puede estar vacía.');
    if (frecuenciaHoras !== undefined && (!Number.isInteger(frecuenciaHoras) || frecuenciaHoras < 1)) {
      throw new Error('La frecuencia de la tarea debe ser un entero de horas mayor o igual a 1.');
    }
    this.tareas.push({ orden: this.tareas.length + 1, descripcion: texto, frecuenciaHoras: frecuenciaHoras ?? null });
    return this;
  }

  construir(): Protocolo {
    const protocolo = Protocolo.crear(this.tipo, this.tareas);
    this.tareas = [];
    return protocolo;
  }
}
