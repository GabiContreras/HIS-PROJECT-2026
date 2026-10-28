import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SignoVital } from '../../../entities/signo-vital.entity.js';
import type {
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
  };
}

@Injectable()
export class SignosVitalesTypeOrmRepository implements SignosVitalesRepository {
  constructor(
    @InjectRepository(SignoVital)
    private readonly signos: Repository<SignoVital>,
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
      relations: { paciente: true },
    });
    return toData(row);
  }

  async list(pacienteId: string | undefined, limit: number): Promise<SignoVitalData[]> {
    const rows = await this.signos.find({
      where: pacienteId ? { paciente: { id: pacienteId } } : {},
      relations: { paciente: true },
      order: { fechaHora: 'DESC' },
      take: limit,
    });
    return rows.map(toData);
  }
}
