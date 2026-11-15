
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository } from 'typeorm';
import { Insumo } from '../../../entities/insumo.entity.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { InventoryLowStock } from '../../../shared/events/inventory-low-stock.event.js';
import { MovimientoInventario } from '../../../entities/movimiento-inventario.entity.js';
import {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../domain/inventory-movement.js';
import { cruzaStockMinimo } from '../domain/low-stock.js';
import {
  ActualizarInsumoInput,
  CrearInsumoInput,
  DescontarStockDiferido,
  DescontarStockInput,
  DescontarStockResult,
  InsumoDetalle,
  InsumoStock,
  InventoryPort,
  ListarMovimientosInput,
  MovimientoDetalle,
  ReponerStockInput,
  ReponerStockResult,
} from '../domain/ports/inventory.port.js';

const UNIQUE_VIOLATION_CODE = '23505';
const NUMERIC_OUT_OF_RANGE_CODE = '22003';

function isUniqueViolation(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      UNIQUE_VIOLATION_CODE
  );
}

function isNumericOutOfRange(error: unknown): boolean {
  return (
    error instanceof QueryFailedError &&
    (error.driverError as { code?: string } | undefined)?.code ===
      NUMERIC_OUT_OF_RANGE_CODE
  );
}

function normalizarMotivo(motivo?: string | null): string | null {
  const limpio = motivo?.trim();
  return limpio ? limpio : null;
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
    @InjectRepository(MovimientoInventario)
    private readonly movimientoRepository: Repository<MovimientoInventario>,
    private readonly eventBus: EventBus,
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
    this.validarCantidad(input.cantidad);

    const { resultado, publicarAlerta } =
      await this.insumoRepository.manager.transaction((transaccion) =>
        this.descontarEn(transaccion, input),
      );
    publicarAlerta();
    return resultado;
  }

  async descontarStockEnTransaccion(
    input: DescontarStockInput,
    manager: EntityManager,
  ): Promise<DescontarStockDiferido> {
    this.validarCantidad(input.cantidad);
    return this.descontarEn(manager, input);
  }

  async reponerStock(input: ReponerStockInput): Promise<ReponerStockResult> {
    const { cantidad } = input;

    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un entero positivo',
      );
    }

    return this.insumoRepository.manager.transaction((transaccion) =>
      this.reponerEn(transaccion, input),
    );
  }

  async listarMovimientos(
    insumoId: string,
    input: ListarMovimientosInput,
  ): Promise<MovimientoDetalle[]> {
    const insumo = await this.insumoRepository.findOneBy({ id: insumoId });
    if (!insumo) {
      throw new NotFoundException('El insumo no existe');
    }

    const movimientos = await this.movimientoRepository.find({
      where: { insumoId },
      order: { createdAt: 'DESC', id: 'DESC' },
      take: input.limit,
      skip: input.offset,
    });

    return movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipo,
      cantidad: m.cantidad,
      stockResultante: m.stockResultante,
      usuarioId: m.usuarioId,
      origen: m.origen,
      referenciaId: m.referenciaId,
      motivo: m.motivo,
      fecha: m.createdAt.toISOString(),
    }));
  }

  private validarCantidad(cantidad: number): void {
    if (!Number.isInteger(cantidad) || cantidad <= 0) {
      throw new BadRequestException(
        'La cantidad debe ser un entero positivo',
      );
    }
  }

  private async descontarEn(
    manager: EntityManager,
    input: DescontarStockInput,
  ): Promise<DescontarStockDiferido> {
    const { insumoId, cantidad } = input;

    const insumos = manager.getRepository(Insumo);
    const result = await insumos
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
      const insumo = await insumos.findOneBy({
        id: insumoId,
      });

      if (!insumo) {
        throw new NotFoundException('El insumo no existe');
      }

      throw new ConflictException('Stock insuficiente');
    }

    const actualizado = result.raw[0] as {
      id: string;
      nombre: string;
      unidad_medida: string;
      cantidad_disponible: number | string;
      stock_minimo: number | string;
    };
    const cantidadRestante = Number(actualizado.cantidad_disponible);
    const stockMinimo = Number(actualizado.stock_minimo);

    await this.registrarMovimiento(
      manager,
      TipoMovimientoInventario.DESCUENTO,
      input,
      cantidadRestante,
    );

    const cruzaMinimo = cruzaStockMinimo(
      cantidadRestante + cantidad,
      cantidadRestante,
      stockMinimo,
    );

    return {
      resultado: {
        insumoId: actualizado.id,
        cantidadDescontada: cantidad,
        cantidadRestante,
      },
      publicarAlerta: () => {
        if (!cruzaMinimo) return;
        this.eventBus.publish(
          new InventoryLowStock({
            insumoId: actualizado.id,
            nombre: actualizado.nombre,
            unidadMedida: actualizado.unidad_medida,
            cantidadDisponible: cantidadRestante,
            stockMinimo,
          }),
        );
      },
    };
  }

  private async reponerEn(
    manager: EntityManager,
    input: ReponerStockInput,
  ): Promise<ReponerStockResult> {
    const { insumoId, cantidad } = input;

    let result;
    try {
      result = await manager
        .getRepository(Insumo)
        .createQueryBuilder()
        .update(Insumo)
        .set({
          cantidadDisponible: () => '"cantidad_disponible" + :cantidad',
        })
        .where('"id" = :insumoId', { insumoId })
        .setParameters({ cantidad })
        .returning('*')
        .execute();
    } catch (error) {
      if (isNumericOutOfRange(error)) {
        throw new ConflictException(
          'La reposición supera el stock máximo que puede registrarse',
        );
      }
      throw error;
    }

    if (result.affected !== 1 || !result.raw?.[0]) {
      throw new NotFoundException('El insumo no existe');
    }

    const actualizado = result.raw[0] as {
      id: string;
      cantidad_disponible: number | string;
    };
    const cantidadActual = Number(actualizado.cantidad_disponible);

    await this.registrarMovimiento(
      manager,
      TipoMovimientoInventario.REPOSICION,
      input,
      cantidadActual,
    );

    return {
      insumoId: actualizado.id,
      cantidadRepuesta: cantidad,
      cantidadActual,
    };
  }

  private async registrarMovimiento(
    manager: EntityManager,
    tipo: TipoMovimientoInventario,
    input: DescontarStockInput | ReponerStockInput,
    stockResultante: number,
  ): Promise<void> {
    await manager.getRepository(MovimientoInventario).insert({
      insumoId: input.insumoId,
      tipo,
      cantidad: input.cantidad,
      stockResultante,
      usuarioId: input.usuarioId ?? null,
      origen: input.origen ?? OrigenMovimientoInventario.MANUAL,
      referenciaId: input.referenciaId ?? null,
      motivo: normalizarMotivo(input.motivo),
    });
  }
}
