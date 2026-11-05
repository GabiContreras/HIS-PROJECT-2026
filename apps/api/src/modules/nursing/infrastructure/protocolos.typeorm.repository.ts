import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProtocoloIngreso } from '../../../entities/protocolo-ingreso.entity.js';
import { TareaProtocolo } from '../../../entities/tarea-protocolo.entity.js';
import type {
  NuevoProtocolo,
  ProtocoloData,
  ProtocolosRepository,
} from '../domain/ports/protocolos.repository.js';

const UNIQUE_VIOLATION = '23505';
const RELATIONS = { paciente: true, tareas: { hechaPor: true } } as const;

function toData(row: ProtocoloIngreso): ProtocoloData {
  return {
    id: row.id,
    ingresoId: row.ingresoId,
    pacienteId: row.paciente.id,
    tipo: row.tipo,
    motivoIngreso: row.motivoIngreso,
    generadoEn: new Date(row.generadoEn),
    tareas: [...row.tareas]
      .sort((a, b) => a.orden - b.orden)
      .map((t) => ({
        id: t.id,
        orden: t.orden,
        descripcion: t.descripcion,
        frecuenciaHoras: t.frecuenciaHoras,
        hecha: t.hecha,
        hechaEn: t.hechaEn ? new Date(t.hechaEn) : null,
        hechaPor: t.hechaPor ? `${t.hechaPor.apellido}, ${t.hechaPor.nombre}` : null,
      })),
  };
}

@Injectable()
export class ProtocolosTypeOrmRepository implements ProtocolosRepository {
  constructor(
    @InjectRepository(ProtocoloIngreso)
    private readonly protocolos: Repository<ProtocoloIngreso>,
    @InjectRepository(TareaProtocolo)
    private readonly tareas: Repository<TareaProtocolo>,
  ) {}

  async crearSiNoExiste(data: NuevoProtocolo): Promise<{ protocolo: ProtocoloData; creado: boolean }> {
    const existente = await this.buscarPorIngreso(data.ingresoId);
    if (existente) return { protocolo: existente, creado: false };
    try {
      // Protocolo y tareas se insertan en la misma transacción (cascade insert).
      const saved = await this.protocolos.save(
        this.protocolos.create({
          ingresoId: data.ingresoId,
          paciente: { id: data.pacienteId },
          tipo: data.tipo,
          motivoIngreso: data.motivoIngreso,
          tareas: data.tareas.map((t) => ({
            orden: t.orden,
            descripcion: t.descripcion,
            frecuenciaHoras: t.frecuenciaHoras,
          })),
        }),
      );
      const row = await this.protocolos.findOneOrFail({
        where: { id: saved.id },
        relations: RELATIONS,
      });
      return { protocolo: toData(row), creado: true };
    } catch (error) {
      // Carrera entre dos procesamientos del mismo ingreso: el índice único evita el duplicado.
      if (error instanceof QueryFailedError && (error.driverError as { code?: string })?.code === UNIQUE_VIOLATION) {
        const ganador = await this.buscarPorIngreso(data.ingresoId);
        if (ganador) return { protocolo: ganador, creado: false };
      }
      throw error;
    }
  }

  async listarPorPaciente(pacienteId: string): Promise<ProtocoloData[]> {
    const rows = await this.protocolos.find({
      where: { paciente: { id: pacienteId } },
      relations: RELATIONS,
      order: { generadoEn: 'DESC' },
    });
    return rows.map(toData);
  }

  async marcarTarea(
    protocoloId: string,
    tareaId: string,
    hecha: boolean,
    usuarioId: string,
  ): Promise<ProtocoloData | null> {
    // El filtro por protocolo evita tocar una tarea ajena; marcar dos veces re-escribe el mismo estado.
    const resultado = await this.tareas.update(
      { id: tareaId, protocolo: { id: protocoloId } },
      hecha
        ? { hecha: true, hechaEn: new Date(), hechaPor: { id: usuarioId } }
        : { hecha: false, hechaEn: null, hechaPor: null },
    );
    if (!resultado.affected) return null;
    const row = await this.protocolos.findOne({ where: { id: protocoloId }, relations: RELATIONS });
    return row ? toData(row) : null;
  }

  private async buscarPorIngreso(ingresoId: string): Promise<ProtocoloData | null> {
    const row = await this.protocolos.findOne({
      where: { ingresoId },
      relations: RELATIONS,
    });
    return row ? toData(row) : null;
  }
}
