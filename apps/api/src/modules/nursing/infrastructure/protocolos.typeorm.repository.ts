import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { ProtocoloIngreso } from '../../../entities/protocolo-ingreso.entity.js';
import type {
  NuevoProtocolo,
  ProtocoloData,
  ProtocolosRepository,
} from '../domain/ports/protocolos.repository.js';

const UNIQUE_VIOLATION = '23505';

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
      .map((t) => ({ orden: t.orden, descripcion: t.descripcion, frecuenciaHoras: t.frecuenciaHoras })),
  };
}

@Injectable()
export class ProtocolosTypeOrmRepository implements ProtocolosRepository {
  constructor(
    @InjectRepository(ProtocoloIngreso)
    private readonly protocolos: Repository<ProtocoloIngreso>,
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
        relations: { paciente: true, tareas: true },
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
      relations: { paciente: true, tareas: true },
      order: { generadoEn: 'DESC' },
    });
    return rows.map(toData);
  }

  private async buscarPorIngreso(ingresoId: string): Promise<ProtocoloData | null> {
    const row = await this.protocolos.findOne({
      where: { ingresoId },
      relations: { paciente: true, tareas: true },
    });
    return row ? toData(row) : null;
  }
}
