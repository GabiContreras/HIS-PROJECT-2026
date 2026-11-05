import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { PacientesService } from '../../admissions/application/pacientes.service.js';
import {
  PROTOCOLOS_REPOSITORY,
  type ProtocoloData,
  type ProtocolosRepository,
} from '../domain/ports/protocolos.repository.js';
import { ProtocolDirector } from '../domain/protocolo/protocol-director.js';

export interface IngresoInput {
  ingresoId: string;
  pacienteId: string;
  motivoIngreso: string;
}

export interface TareaProtocoloView {
  id: string;
  orden: number;
  descripcion: string;
  frecuenciaHoras: number | null;
  hecha: boolean;
  hechaEn: string | null;
  /** "Apellido, Nombre" de quien la marcó. */
  hechaPor: string | null;
}

export interface ProtocoloView {
  id: string;
  ingresoId: string;
  pacienteId: string;
  tipo: string;
  motivoIngreso: string;
  generadoEn: string;
  tareas: TareaProtocoloView[];
}

/** HU 2.1: genera (con el Patrón Builder) y consulta el protocolo de atención base de cada ingreso. */
@Injectable()
export class ProtocolosService {
  private readonly director = new ProtocolDirector();

  constructor(
    @Inject(PROTOCOLOS_REPOSITORY)
    private readonly repository: ProtocolosRepository,
    private readonly pacientes: PacientesService,
  ) {}

  /**
   * Genera el protocolo del ingreso. Idempotente por `ingresoId`: reprocesar devuelve el existente.
   * 400 si el motivo no tiene protocolo definido; 404 si el paciente no existe.
   */
  async generarParaIngreso(input: IngresoInput): Promise<{ protocolo: ProtocoloView; creado: boolean }> {
    const motivo = input.motivoIngreso.trim();
    const protocolo = this.director.construirPorMotivo(motivo);
    if (protocolo === null) {
      throw new BadRequestException(
        `El motivo de ingreso "${motivo}" no tiene un protocolo de atención definido (disponibles: cirugía programada, neumonía / infección respiratoria).`,
      );
    }
    // Admisión es dueño de pacientes: se consulta por su caso de uso (404 si no existe).
    await this.pacientes.get(input.pacienteId);

    const { protocolo: guardado, creado } = await this.repository.crearSiNoExiste({
      ingresoId: input.ingresoId,
      pacienteId: input.pacienteId,
      tipo: protocolo.tipo,
      motivoIngreso: motivo,
      tareas: protocolo.tareas,
    });
    return { protocolo: this.toView(guardado), creado };
  }

  async listarPorPaciente(pacienteId: string): Promise<ProtocoloView[]> {
    await this.pacientes.get(pacienteId);
    const rows = await this.repository.listarPorPaciente(pacienteId);
    return rows.map((row) => this.toView(row));
  }

  /**
   * Marca o desmarca una tarea del checklist. Idempotente. 404 si la tarea no existe en ese protocolo.
   * Devuelve el protocolo completo actualizado.
   */
  async marcarTarea(
    protocoloId: string,
    tareaId: string,
    hecha: boolean,
    identity: SessionIdentity,
  ): Promise<ProtocoloView> {
    const protocolo = await this.repository.marcarTarea(protocoloId, tareaId, hecha, identity.accountId);
    if (protocolo === null) throw new NotFoundException('La tarea no existe en ese protocolo');
    return this.toView(protocolo);
  }

  private toView(row: ProtocoloData): ProtocoloView {
    return {
      id: row.id,
      ingresoId: row.ingresoId,
      pacienteId: row.pacienteId,
      tipo: row.tipo,
      motivoIngreso: row.motivoIngreso,
      generadoEn: row.generadoEn.toISOString(),
      tareas: row.tareas.map((t) => ({
        id: t.id,
        orden: t.orden,
        descripcion: t.descripcion,
        frecuenciaHoras: t.frecuenciaHoras,
        hecha: t.hecha,
        hechaEn: t.hechaEn ? t.hechaEn.toISOString() : null,
        hechaPor: t.hechaPor,
      })),
    };
  }
}
