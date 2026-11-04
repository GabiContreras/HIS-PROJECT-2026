import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, IsNull, Not, Repository } from 'typeorm';
import { SignoVital } from '../../../entities/signo-vital.entity.js';
import type {
  NuevoControl,
  NuevoSignoVital,
  SignoVitalData,
  SignosVitalesRepository,
} from '../domain/ports/signos-vitales.repository.js';

function toData(row: SignoVital): SignoVitalData {
  return {
    id: row.id,
    pacienteId: row.paciente.id,
    paciente: `${row.paciente.apellido}, ${row.paciente.nombre}`,
    tipo: row.tipo,
    // La columna es NUMERIC en PostgreSQL: el driver lo devuelve como string.
    valor: Number(row.valor),
    fechaHora: new Date(row.fechaHora),
    controlId: row.controlId,
    registradoPor: `${row.registradoPor.apellido}, ${row.registradoPor.nombre}`,
  };
}

@Injectable()
export class SignosVitalesTypeOrmRepository implements SignosVitalesRepository {
  constructor(
    @InjectRepository(SignoVital)
    private readonly signos: Repository<SignoVital>,
    private readonly dataSource: DataSource,
  ) {}

  async create(data: NuevoSignoVital): Promise<SignoVitalData> {
    const saved = await this.signos.save(
      this.signos.create({
        paciente: { id: data.pacienteId },
        registradoPor: { id: data.registradoPorId },
        tipo: data.tipo,
        valor: data.valor,
      }),
    );
    const row = await this.signos.findOneOrFail({
      where: { id: saved.id },
      relations: { paciente: true, registradoPor: true },
    });
    return toData(row);
  }

  async list(pacienteId: string | undefined, limit: number): Promise<SignoVitalData[]> {
    const rows = await this.signos.find({
      where: pacienteId ? { paciente: { id: pacienteId } } : {},
      relations: { paciente: true, registradoPor: true },
      order: { fechaHora: 'DESC' },
      take: limit,
    });
    return rows.map(toData);
  }

  async createControl(data: NuevoControl): Promise<SignoVitalData[]> {
    const controlId = randomUUID();
    await this.dataSource.transaction(async (manager) => {
      const repo = manager.getRepository(SignoVital);
      await repo.save(
        data.lecturas.map((lectura) =>
          repo.create({
            paciente: { id: data.pacienteId },
            registradoPor: { id: data.registradoPorId },
            tipo: lectura.tipo,
            valor: lectura.valor,
            controlId,
          }),
        ),
      );
    });
    const rows = await this.signos.find({
      where: { controlId },
      relations: { paciente: true, registradoPor: true },
      order: { fechaHora: 'DESC' },
    });
    return rows.map(toData);
  }

  async listControles(pacienteId: string | undefined, limit: number): Promise<SignoVitalData[]> {
    const rows = await this.signos.find({
      where: { controlId: Not(IsNull()), ...(pacienteId ? { paciente: { id: pacienteId } } : {}) },
      relations: { paciente: true, registradoPor: true },
      order: { fechaHora: 'DESC' },
      take: limit,
    });
    return rows.map(toData);
  }
}
