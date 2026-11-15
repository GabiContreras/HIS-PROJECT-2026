import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Prestacion } from '../../../entities/prestacion.entity.js';
import { Tarifa } from '../../../entities/tarifa.entity.js';
import { PrestacionData, TarifaData } from '../domain/nomenclador.js';
import { NomencladorRepository } from '../domain/nomenclador.repository.js';

@Injectable()
export class TypeOrmNomencladorRepository implements NomencladorRepository {
  constructor(
    @InjectRepository(Prestacion)
    private readonly prestaciones: Repository<Prestacion>,

    @InjectRepository(Tarifa)
    private readonly tarifas: Repository<Tarifa>,
  ) {}

  async findPrestacionActiva(codigo: string): Promise<PrestacionData | null> {
    const prestacion = await this.prestaciones.findOneBy({
      codigo,
      activo: true,
    });
    return prestacion
      ? {
          id: prestacion.id,
          codigo: prestacion.codigo,
          valorBasePesos: prestacion.valorBasePesos,
          copagoPesos: prestacion.copagoPesos,
        }
      : null;
  }

  async findTarifaActiva(
    financiadorId: string,
    prestacionId: string,
  ): Promise<TarifaData | null> {
    const tarifa = await this.tarifas.findOneBy({
      financiadorId,
      prestacionId,
      activo: true,
    });
    return tarifa
      ? { valorPesos: tarifa.valorPesos, copagoPesos: tarifa.copagoPesos }
      : null;
  }
}
