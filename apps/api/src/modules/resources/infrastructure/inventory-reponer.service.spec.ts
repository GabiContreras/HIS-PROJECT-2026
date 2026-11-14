import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { InventoryService } from './inventory.service.js';

describe('InventoryService reponerStock', () => {
  let service: InventoryService;
  let queryBuilder: Record<string, ReturnType<typeof vi.fn>>;
  let repository: { createQueryBuilder: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    queryBuilder = {
      update: vi.fn(),
      set: vi.fn(),
      where: vi.fn(),
      setParameters: vi.fn(),
      returning: vi.fn(),
      execute: vi.fn(),
    };

    Object.values(queryBuilder).forEach((method) => {
      method.mockReturnValue(queryBuilder);
    });

    repository = { createQueryBuilder: vi.fn(() => queryBuilder) };
    service = new InventoryService(repository as never);
  });

  it('repone stock y devuelve el saldo actual', async () => {
    queryBuilder.execute.mockResolvedValue({
      affected: 1,
      raw: [{ id: 'insumo-1', cantidad_disponible: '27' }],
    });

    await expect(
      service.reponerStock({ insumoId: 'insumo-1', cantidad: 20 }),
    ).resolves.toEqual({
      insumoId: 'insumo-1',
      cantidadRepuesta: 20,
      cantidadActual: 27,
    });
  });

  it('suma en la base con un UPDATE atomico y sin leer antes', async () => {
    queryBuilder.execute.mockResolvedValue({
      affected: 1,
      raw: [{ id: 'insumo-1', cantidad_disponible: 25 }],
    });

    await service.reponerStock({ insumoId: 'insumo-1', cantidad: 5 });

    const { cantidadDisponible } = queryBuilder.set.mock.calls[0][0] as {
      cantidadDisponible: () => string;
    };
    expect(cantidadDisponible()).toBe('"cantidad_disponible" + :cantidad');
    expect(queryBuilder.where).toHaveBeenCalledWith('"id" = :insumoId', {
      insumoId: 'insumo-1',
    });
    expect(queryBuilder.setParameters).toHaveBeenCalledWith({ cantidad: 5 });
    expect(queryBuilder.returning).toHaveBeenCalledWith('*');
  });

  it('devuelve 404 cuando el insumo no existe', async () => {
    queryBuilder.execute.mockResolvedValue({ affected: 0, raw: [] });

    await expect(
      service.reponerStock({ insumoId: 'inexistente', cantidad: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([0, -3, 1.5, Number.NaN])(
    'rechaza la cantidad %s sin tocar la base',
    async (cantidad) => {
      await expect(
        service.reponerStock({ insumoId: 'insumo-1', cantidad }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createQueryBuilder).not.toHaveBeenCalled();
    },
  );

  it('devuelve 409 cuando la suma supera el rango de la columna', async () => {
    queryBuilder.execute.mockRejectedValue(
      new QueryFailedError('UPDATE', [], { code: '22003' } as never),
    );

    await expect(
      service.reponerStock({ insumoId: 'insumo-1', cantidad: 2147483647 }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('propaga otros errores de base de datos', async () => {
    const error = new QueryFailedError('UPDATE', [], { code: '08006' } as never);
    queryBuilder.execute.mockRejectedValue(error);

    await expect(
      service.reponerStock({ insumoId: 'insumo-1', cantidad: 1 }),
    ).rejects.toBe(error);
  });
});
