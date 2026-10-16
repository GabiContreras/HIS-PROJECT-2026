
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Insumo } from '../../../entities/insumo.entity.js';
import {
  DescontarStockInput,
  DescontarStockResult,
  InventoryPort,
} from '../domain/ports/inventory.port.js';

@Injectable()
export class InventoryService implements InventoryPort {
  constructor(
    @InjectRepository(Insumo)
    private readonly insumoRepository: Repository<Insumo>,
  ) {}

  async descontarStock(
    input: DescontarStockInput,
  ): Promise<DescontarStockResult> {
    if (
      !Number.isInteger(input.cantidad) ||
      input.cantidad <= 0
    ) {
      throw new Error('La cantidad debe ser un entero positivo');
    }

    const result = await this.insumoRepository
      .createQueryBuilder()
      .update(Insumo)
      .set({
        cantidadDisponible: () =>
          '"cantidad_disponible" - :cantidad',
      })
      .where('id = :insumoId', {
        insumoId: input.insumoId,
      })
      .andWhere('cantidad_disponible >= :cantidad', {
        cantidad: input.cantidad,
      })
      .setParameters({ cantidad: input.cantidad })
      .returning('*')
      .execute();

    if (result.affected !== 1 || !result.raw?.[0]) {
      throw new Error(
        'Insumo inexistente o stock insuficiente',
      );
    }

    const actualizado = result.raw[0] as {
      id: string;
      cantidad_disponible: number | string;
    };

    return {
      insumoId: actualizado.id,
      cantidadDescontada: input.cantidad,
      cantidadRestante: Number(actualizado.cantidad_disponible),
    };
  }
}
