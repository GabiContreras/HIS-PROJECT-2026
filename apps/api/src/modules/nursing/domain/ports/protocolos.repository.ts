import type { TareaProtocolo } from '../protocolo/protocolo.js';

export interface NuevoProtocolo {
  ingresoId: string;
  pacienteId: string;
  tipo: string;
  motivoIngreso: string;
  tareas: readonly TareaProtocolo[];
}

/** Tarea persistida del checklist, con su estado y quién/cuándo la marcó. */
export interface TareaProtocoloData extends TareaProtocolo {
  id: string;
  hecha: boolean;
  hechaEn: Date | null;
  /** "Apellido, Nombre" de quien la marcó; null si no está hecha. */
  hechaPor: string | null;
}

export interface ProtocoloData {
  id: string;
  ingresoId: string;
  pacienteId: string;
  tipo: string;
  motivoIngreso: string;
  generadoEn: Date;
  tareas: TareaProtocoloData[];
}

export interface ProtocolosRepository {
  /** Crea el protocolo; si ya existe uno para el mismo `ingresoId` devuelve el existente (`creado: false`). */
  crearSiNoExiste(data: NuevoProtocolo): Promise<{ protocolo: ProtocoloData; creado: boolean }>;
  /** Protocolos del paciente, del más nuevo al más viejo. */
  listarPorPaciente(pacienteId: string): Promise<ProtocoloData[]>;
  /**
   * Marca (`hecha = true`, con fecha y usuario) o desmarca (limpia ambos) una tarea.
   * Devuelve el protocolo actualizado, o null si la tarea no existe o no pertenece a ese protocolo.
   */
  marcarTarea(
    protocoloId: string,
    tareaId: string,
    hecha: boolean,
    usuarioId: string,
  ): Promise<ProtocoloData | null>;
}

export const PROTOCOLOS_REPOSITORY = Symbol('PROTOCOLOS_REPOSITORY');
