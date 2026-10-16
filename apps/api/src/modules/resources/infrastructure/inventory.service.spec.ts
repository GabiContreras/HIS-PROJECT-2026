
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InventoryService } from './inventory.service.js';

describe('InventoryService', () => {
  let service: InventoryService;
  let queryBuilder: {
    update: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    where: ReturnType<typeof vi.fn>;
    andWhere: ReturnType<typeof vi.fn>;
    setParameters: ReturnType<typeof vi.fn>;
    returning: ReturnType<typeof vi.fn>;
    execute: ReturnType<typeof vi.fn>;
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

    service = new InventoryService({
      createQueryBuilder: vi.fn(() => queryBuilder),
    } as never);
  });

  it('descuenta stock y devuelve el saldo restante', async () => {
    queryBuilder.execute.mockResolvedValue({
      affected: 1,
      raw: [{ id: 'insumo-1', cantidad_disponible: 7 }],
    });

    const resultado = await service.descontarStock({
      insumoId: 'insumo-1',
      cantidad: 3,
    });

    expect(resultado).toEqual({
      insumoId: 'insumo-1',
      cantidadDescontada: 3,
      cantidadRestante: 7,
    });
  });

  it('rechaza el descuento cuando no hay stock suficiente', async () => {
    queryBuilder.execute.mockResolvedValue({
      affected: 0,
      raw: [],
    });

    await expect(
      service.descontarStock({
        insumoId: 'insumo-1',
        cantidad: 5,
      }),
    ).rejects.toThrow('Insumo inexistente o stock insuficiente');
  });

  it('rechaza cantidades no positivas o no enteras', async () => {
    await expect(
      service.descontarStock({
        insumoId: 'insumo-1',
        cantidad: 0,
      }),
    ).rejects.toThrow('La cantidad debe ser un entero positivo');

    await expect(
      service.descontarStock({
        insumoId: 'insumo-1',
        cantidad: 1.5,
      }),
    ).rejects.toThrow('La cantidad debe ser un entero positivo');
  });
});
