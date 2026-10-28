
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  let service: InventoryService;
  let queryBuilder: Record<string, ReturnType<typeof vi.fn>>;
  let repository: {
    createQueryBuilder: ReturnType<typeof vi.fn>;
    findOneBy: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    queryBuilder = {
      update: vi.fn(),
      set: vi.fn(),
      where: vi.fn(),
      andWhere: vi.fn(),
      setParameters: vi.fn(),
      returning: vi.fn(),
      execute: vi.fn(),
    };

    Object.values(queryBuilder).forEach((method) => {
      method.mockReturnValue(queryBuilder);
    });

    repository = {
      createQueryBuilder: vi.fn(() => queryBuilder),
      findOneBy: vi.fn(),
    };

    service = new InventoryService(repository as never);
  });

  it('descuenta stock y devuelve el saldo restante', async () => {
    queryBuilder.execute.mockResolvedValue({
      affected: 1,
      raw: [{ id: 'insumo-1', cantidad_disponible: 7 }],
    });

    await expect(
      service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 }),
    ).resolves.toEqual({
      insumoId: 'insumo-1',
      cantidadDescontada: 3,
      cantidadRestante: 7,
    });
  });

  it('devuelve 404 cuando el insumo no existe', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 0, raw: [] });
    repository.findOneBy.mockResolvedValue(null);

    await expect(
      service.descontarStock({ insumoId: 'inexistente', cantidad: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('devuelve 409 cuando no hay stock suficiente', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 0, raw: [] });
    repository.findOneBy.mockResolvedValue({
      id: 'insumo-1',
      cantidadDisponible: 0,
    });

    await expect(
      service.descontarStock({ insumoId: 'insumo-1', cantidad: 5 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rechaza cantidades no positivas o no enteras', async () => {
  await expect(
    service.descontarStock({ insumoId: 'insumo-1', cantidad: 0 }),
  ).rejects.toBeInstanceOf(BadRequestException);

  await expect(
    service.descontarStock({ insumoId: 'insumo-1', cantidad: 1.5 }),
  ).rejects.toBeInstanceOf(BadRequestException);
});
});
