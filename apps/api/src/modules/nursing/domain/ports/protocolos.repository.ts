import type { TareaProtocolo } from '../protocolo/protocolo.js';

export interface NuevoProtocolo {
  ingresoId: string;
  pacienteId: string;
  tipo: string;
  motivoIngreso: string;
  tareas: readonly TareaProtocolo[];
}

export interface ProtocoloData {
  id: string;
  ingresoId: string;
  pacienteId: string;
  tipo: string;
  motivoIngreso: string;
  generadoEn: Date;
  tareas: TareaProtocolo[];
}

export interface ProtocolosRepository {
  /** Crea el protocolo; si ya existe uno para el mismo `ingresoId` devuelve el existente (`creado: false`). */
  crearSiNoExiste(data: NuevoProtocolo): Promise<{ protocolo: ProtocoloData; creado: boolean }>;
  /** Protocolos del paciente, del más nuevo al más viejo. */
  listarPorPaciente(pacienteId: string): Promise<ProtocoloData[]>;
}

export const PROTOCOLOS_REPOSITORY = Symbol('PROTOCOLOS_REPOSITORY');
