
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
    const { insumoId, cantidad } = input;

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un entero positivo',
      );
    }

    const result = await this.insumoRepository
      .createQueryBuilder()
      .update(Insumo)
      .set({
        cantidadDisponible: () => '"cantidad_disponible" - :cantidad',
      })
      .where('"id" = :insumoId', { insumoId })
      .andWhere('"cantidad_disponible" >= :cantidad', { cantidad })
      .setParameters({ cantidad })
      .returning('*')
      .execute();

    if (result.affected !== 1 || !result.raw?.[0]) {
      const insumo = await this.insumoRepository.findOneBy({
        id: insumoId,
      });

      if (!insumo) {
        throw new NotFoundException('El insumo no existe');
      }

      throw new ConflictException('Stock insuficiente');
    }

    const actualizado = result.raw[0] as {
      id: string;
      cantidad_disponible: number;
    };

    return {
      insumoId: actualizado.id,
      cantidadDescontada: cantidad,
      cantidadRestante: Number(actualizado.cantidad_disponible),
    };
  }
}
