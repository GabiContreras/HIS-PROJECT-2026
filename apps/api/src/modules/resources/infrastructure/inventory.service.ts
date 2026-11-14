
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository } from 'typeorm';
import { Insumo } from '../../../entities/insumo.entity.js';
import {
  ActualizarInsumoInput,
  CrearInsumoInput,
  DescontarStockInput,
  DescontarStockResult,
  InsumoDetalle,
  InsumoStock,
  InventoryPort,
} from '../domain/ports/inventory.port.js';

const UNIQUE_VIOLATION_CODE = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION_CODE
  );
}

function toInsumoDetalle(insumo: Insumo): InsumoDetalle {
  return {
    id: insumo.id,
    nombre: insumo.nombre,
    unidadMedida: insumo.unidadMedida,
    cantidadDisponible: insumo.cantidadDisponible,
    precioPesos: insumo.precioPesos,
    stockMinimo: insumo.stockMinimo,
  };
}

@Injectable()
export class InventoryService implements InventoryPort {
  constructor(
    @InjectRepository(Insumo)
    private readonly insumoRepository: Repository<Insumo>,
  ) {}

  async listar(): Promise<InsumoStock[]> {
    const insumos = await this.insumoRepository.find({ order: { nombre: 'ASC' } });
    return insumos.map((i) => ({
      id: i.id,
      nombre: i.nombre,
      unidadMedida: i.unidadMedida,
      cantidadDisponible: i.cantidadDisponible,
    }));
  }

  async crear(input: CrearInsumoInput): Promise<InsumoDetalle> {
    const insumo = this.insumoRepository.create({
      nombre: input.nombre.trim(),
      unidadMedida: input.unidadMedida.trim(),
      precioPesos: input.precioPesos ?? 0,
      stockMinimo: input.stockMinimo ?? 0,
      cantidadDisponible: 0,
    });

    try {
      return toInsumoDetalle(await this.insumoRepository.save(insumo));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('Ya existe un insumo con ese nombre');
      }
      throw error;
    }
  }

  async actualizar(
    insumoId: string,
    input: ActualizarInsumoInput,
  ): Promise<InsumoDetalle> {
    const cambios: Partial<Insumo> = {};
    if (input.unidadMedida !== undefined) {
      cambios.unidadMedida = input.unidadMedida.trim();
    }
    if (input.precioPesos !== undefined) {
      cambios.precioPesos = input.precioPesos;
    }
    if (input.stockMinimo !== undefined) {
      cambios.stockMinimo = input.stockMinimo;
    }

    if (Object.keys(cambios).length === 0) {
      throw new BadRequestException('Indique al menos un campo para actualizar');
    }

    const result = await this.insumoRepository
      .createQueryBuilder()
      .update(Insumo)
      .set(cambios)
      .where('"id" = :insumoId', { insumoId })
      .returning('*')
      .execute();

    if (result.affected !== 1 || !result.raw?.[0]) {
      throw new NotFoundException('El insumo no existe');
    }

    const actualizado = result.raw[0] as {
      id: string;
      nombre: string;
      unidad_medida: string;
      cantidad_disponible: number | string;
      precio_pesos: number | string;
      stock_minimo: number | string;
    };

    return {
      id: actualizado.id,
      nombre: actualizado.nombre,
      unidadMedida: actualizado.unidad_medida,
      cantidadDisponible: Number(actualizado.cantidad_disponible),
      precioPesos: Number(actualizado.precio_pesos),
      stockMinimo: Number(actualizado.stock_minimo),
    };
  }

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
      cantidad_disponible: number | string;
    };

    return {
      insumoId: actualizado.id,
      cantidadDescontada: cantidad,
      cantidadRestante: Number(actualizado.cantidad_disponible),
    };
  }
}
