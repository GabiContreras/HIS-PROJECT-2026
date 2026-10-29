import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RegistroClinico } from '../../../entities/registro-clinico.entity.js';
import type {
  HistoriaClinicaRepository,
  NuevoRegistroClinico,
  RegistroClinicoData,
} from '../domain/ports/historia-clinica.repository.js';

function toData(row: RegistroClinico): RegistroClinicoData {
  return {
    id: row.id,
    categoria: row.categoria,
    titulo: row.titulo,
    detalle: row.detalle,
    registradoPor: `${row.registradoPor.apellido}, ${row.registradoPor.nombre}`,
    fechaHora: new Date(row.fechaHora),
  };
}

@Injectable()
export class HistoriaClinicaTypeOrmRepository implements HistoriaClinicaRepository {
  constructor(
    @InjectRepository(RegistroClinico)
    private readonly registros: Repository<RegistroClinico>,
  ) {}

  async create(data: NuevoRegistroClinico): Promise<RegistroClinicoData> {
    const saved = await this.registros.save(
      this.registros.create({
        paciente: { id: data.pacienteId },
        registradoPor: { id: data.registradoPorId },
        categoria: data.categoria,
        titulo: data.titulo,
        detalle: data.detalle,
      }),
    );
    const row = await this.registros.findOneOrFail({
      where: { id: saved.id },
      relations: { registradoPor: true },
    });
    return toData(row);
  }

  async listByPaciente(pacienteId: string): Promise<RegistroClinicoData[]> {
    const rows = await this.registros.find({
      where: { paciente: { id: pacienteId } },
      relations: { registradoPor: true },
      order: { fechaHora: 'DESC' },
    });
    return rows.map(toData);
  }
}
