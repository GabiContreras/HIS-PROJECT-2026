import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Insumo } from '../../../entities/insumo.entity.js';
import { InventoryLowStock } from '../../../shared/events/inventory-low-stock.event.js';
import { InventoryService } from './inventory.service.js';

interface FakeInsumo {
  nombre: string;
  unidadMedida: string;
  stock: number;
  stockMinimo: number;
}

function createFakeDb(initial: Record<string, FakeInsumo>) {
  const insumosData = new Map(Object.entries(initial).map(([id, v]) => [id, { ...v }]));
  const log: string[] = [];
  const control = { failInsert: false, failCommit: false };

  const insumos = {
    findOneBy: async ({ id }: { id: string }) => (insumosData.has(id) ? { id } : null),
    createQueryBuilder: () => {
      let id = '';
      let cantidad = 0;
      const builder: Record<string, unknown> = {};
      builder.update = () => builder;
      builder.set = () => builder;
      builder.where = (_c: string, params: { insumoId: string }) => {
        id = params.insumoId;
        return builder;
      };
      builder.andWhere = (_c: string, params: { cantidad: number }) => {
        cantidad = params.cantidad;
        return builder;
      };
      builder.setParameters = () => builder;
      builder.returning = () => builder;
      builder.execute = async () => {
        const fila = insumosData.get(id);
        if (!fila || fila.stock < cantidad) return { affected: 0, raw: [] };
        fila.stock -= cantidad;
        return {
          affected: 1,
          raw: [
            {
              id,
              nombre: fila.nombre,
              unidad_medida: fila.unidadMedida,
              cantidad_disponible: String(fila.stock),
              stock_minimo: String(fila.stockMinimo),
            },
          ],
        };
      };
      return builder;
    },
  };

  const movimientoRepository = {
    insert: vi.fn(async () => {
      if (control.failInsert) throw new Error('insert falló');
    }),
    find: vi.fn(),
  };

  const manager: Record<string, unknown> = {};
  manager.getRepository = (entity: unknown) =>
    entity === Insumo ? insumos : movimientoRepository;
  manager.transaction = async (work: (m: unknown) => Promise<unknown>) => {
    const previo = new Map([...insumosData].map(([k, v]) => [k, { ...v }]));
    try {
      const resultado = await work(manager);
      if (control.failCommit) throw new Error('commit falló');
      log.push('commit');
      return resultado;
    } catch (error) {
      insumosData.clear();
      previo.forEach((v, k) => insumosData.set(k, v));
      log.push('rollback');
      throw error;
    }
  };

  return { insumosData, insumos, movimientoRepository, manager, log, control };
}

const AGUJA: FakeInsumo = { nombre: 'Aguja', unidadMedida: 'unidad', stock: 8, stockMinimo: 5 };

describe('InventoryService alerta de stock mínimo', () => {
  let db: ReturnType<typeof createFakeDb>;
  let publish: ReturnType<typeof vi.fn>;
  let service: InventoryService;

  const montar = (insumos: Record<string, FakeInsumo>) => {
    db = createFakeDb(insumos);
    publish = vi.fn(() => {
      db.log.push('publish');
    });
    service = new InventoryService(
      { ...db.insumos, manager: db.manager } as never,
      db.movimientoRepository as never,
      { publish } as never,
    );
  };

  beforeEach(() => {
    montar({ 'insumo-1': { ...AGUJA } });
  });

  it('publica una vez, con el payload completo, al dejar el stock justo en el mínimo', async () => {
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 });

    expect(publish).toHaveBeenCalledTimes(1);
    const evento = publish.mock.calls[0][0] as InventoryLowStock;
    expect(evento).toBeInstanceOf(InventoryLowStock);
    expect(evento.type).toBe('inventory.low-stock');
    expect(evento.payload).toEqual({
      insumoId: 'insumo-1',
      nombre: 'Aguja',
      unidadMedida: 'unidad',
      cantidadDisponible: 5,
      stockMinimo: 5,
    });
  });

  it('publica al pasar por debajo del mínimo', async () => {
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 5 });

    expect(publish).toHaveBeenCalledTimes(1);
    expect((publish.mock.calls[0][0] as InventoryLowStock).payload.cantidadDisponible).toBe(3);
  });

  it('no publica si el stock resultante queda por encima del mínimo', async () => {
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 2 });

    expect(publish).not.toHaveBeenCalled();
  });

  it('no vuelve a publicar si el stock ya estaba en o por debajo del mínimo', async () => {
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 });
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 });
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 });

    expect(publish).toHaveBeenCalledTimes(1);
  });

  it('vuelve a publicar si tras reponer por encima del mínimo un nuevo descuento lo cruza', async () => {
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 });
    db.insumosData.get('insumo-1')!.stock = 12;

    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 2 });
    expect(publish).toHaveBeenCalledTimes(1);

    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 5 });
    expect(publish).toHaveBeenCalledTimes(2);
  });

  it('con stock mínimo 0 nunca publica, ni al llegar a 0', async () => {
    montar({ 'insumo-1': { ...AGUJA, stock: 2, stockMinimo: 0 } });

    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 2 });

    expect(db.insumosData.get('insumo-1')!.stock).toBe(0);
    expect(publish).not.toHaveBeenCalled();
  });

  it('publica cuando el descuento lleva el stock a 0 y había un mínimo configurado', async () => {
    montar({ 'insumo-1': { ...AGUJA, stock: 6, stockMinimo: 5 } });

    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 6 });

    expect((publish.mock.calls[0][0] as InventoryLowStock).payload.cantidadDisponible).toBe(0);
  });

  it('el stock mínimo se lee del mismo UPDATE: un mínimo mayor al stock inicial no publica', async () => {
    montar({ 'insumo-1': { ...AGUJA, stock: 4, stockMinimo: 5 } });

    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 });

    expect(publish).not.toHaveBeenCalled();
  });

  it('publica después de que la transacción propia terminó', async () => {
    await service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 });

    expect(db.log).toEqual(['commit', 'publish']);
  });

  it('si la transacción propia se revierte, no publica', async () => {
    db.control.failInsert = true;

    await expect(
      service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 }),
    ).rejects.toThrow('insert falló');

    expect(publish).not.toHaveBeenCalled();
    expect(db.log).toEqual(['rollback']);
    expect(db.insumosData.get('insumo-1')!.stock).toBe(8);
  });

  it('si falla el commit de la transacción propia, no publica', async () => {
    db.control.failCommit = true;

    await expect(
      service.descontarStock({ insumoId: 'insumo-1', cantidad: 3 }),
    ).rejects.toThrow('commit falló');

    expect(publish).not.toHaveBeenCalled();
  });

  it('con manager recibido no publica durante el descuento: devuelve la alerta para publicarla tras el commit', async () => {
    const diferido = await service.descontarStockEnTransaccion(
      { insumoId: 'insumo-1', cantidad: 3 },
      db.manager as never,
    );

    expect(diferido.resultado).toEqual({
      insumoId: 'insumo-1',
      cantidadDescontada: 3,
      cantidadRestante: 5,
    });
    expect(publish).not.toHaveBeenCalled();

    diferido.publicarAlerta();

    expect(publish).toHaveBeenCalledTimes(1);
    expect((publish.mock.calls[0][0] as InventoryLowStock).payload.cantidadDisponible).toBe(5);
  });

  it('con manager recibido, si no cruza el mínimo publicarAlerta no publica', async () => {
    const diferido = await service.descontarStockEnTransaccion(
      { insumoId: 'insumo-1', cantidad: 1 },
      db.manager as never,
    );

    diferido.publicarAlerta();

    expect(publish).not.toHaveBeenCalled();
  });

  it('con manager recibido, si el movimiento falla el descuento se rechaza y no hay alerta', async () => {
    db.control.failInsert = true;

    await expect(
      service.descontarStockEnTransaccion({ insumoId: 'insumo-1', cantidad: 3 }, db.manager as never),
    ).rejects.toThrow('insert falló');

    expect(publish).not.toHaveBeenCalled();
  });

  it('el stock insuficiente (409) no publica ni cambia nada', async () => {
    await expect(
      service.descontarStock({ insumoId: 'insumo-1', cantidad: 9 }),
    ).rejects.toBeInstanceOf(ConflictException);

    expect(publish).not.toHaveBeenCalled();
    expect(db.insumosData.get('insumo-1')!.stock).toBe(8);
  });

  it('el insumo inexistente (404) no publica', async () => {
    await expect(
      service.descontarStock({ insumoId: 'inexistente', cantidad: 1 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(publish).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5])('la cantidad %s se rechaza con 400 y no publica', async (cantidad) => {
    await expect(
      service.descontarStock({ insumoId: 'insumo-1', cantidad }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.descontarStockEnTransaccion({ insumoId: 'insumo-1', cantidad }, db.manager as never),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(publish).not.toHaveBeenCalled();
  });

  it('con descuentos simultáneos solo uno cruza el mínimo y publica una vez', async () => {
    montar({ 'insumo-1': { ...AGUJA, stock: 20, stockMinimo: 10 } });

    const resultados = await Promise.allSettled(
      Array.from({ length: 15 }, () => service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 })),
    );

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(15);
    expect(db.insumosData.get('insumo-1')!.stock).toBe(5);
    expect(publish).toHaveBeenCalledTimes(1);
    expect((publish.mock.calls[0][0] as InventoryLowStock).payload.cantidadDisponible).toBe(10);
  });

  it('con stock para menos descuentos de los pedidos, los sobrantes responden 409 y publican una sola alerta', async () => {
    montar({ 'insumo-1': { ...AGUJA, stock: 12, stockMinimo: 10 } });

    const resultados = await Promise.allSettled(
      Array.from({ length: 15 }, () => service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 })),
    );

    const rechazados = resultados.filter((r) => r.status === 'rejected');
    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(12);
    expect(rechazados).toHaveLength(3);
    rechazados.forEach((r) =>
      expect((r as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException),
    );
    expect(publish).toHaveBeenCalledTimes(1);
  });
});
