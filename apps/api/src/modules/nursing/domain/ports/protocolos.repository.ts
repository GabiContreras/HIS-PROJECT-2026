import type { TareaProtocolo } from '../protocolo/protocolo.js';

export interface NuevoProtocolo {
  ingresoId: string;
  pacienteId: string;
  tipo: string;
  motivoIngreso: string;
  tareas: readonly TareaProtocolo[];
}

export interface TareaProtocoloData extends TareaProtocolo {
  id: string;
  hecha: boolean;
  hechaEn: Date | null;
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
  crearSiNoExiste(data: NuevoProtocolo): Promise<{ protocolo: ProtocoloData; creado: boolean }>;
  listarPorPaciente(pacienteId: string): Promise<ProtocoloData[]>;
  marcarTarea(
    protocoloId: string,
    tareaId: string,
    hecha: boolean,
    usuarioId: string,
  ): Promise<ProtocoloData | null>;
}

export const PROTOCOLOS_REPOSITORY = Symbol('PROTOCOLOS_REPOSITORY');
