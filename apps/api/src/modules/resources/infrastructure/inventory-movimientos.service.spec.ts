import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { Insumo } from '../../../entities/insumo.entity.js';
import {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../domain/inventory-movement.js';
import { InventoryService } from './inventory.service.js';

const INT_MAX = 2147483647;

function createFakeDb(initial: Record<string, number>) {
  const stock = new Map<string, number>(Object.entries(initial));
  const movimientos: Record<string, unknown>[] = [];
  const control = { failInsert: false };

  const insumos = {
    createQueryBuilder: () => {
      let id = '';
      let cantidad = 0;
      let suma = false;
      let conGuarda = false;
      const builder: Record<string, unknown> = {};
      builder.update = () => builder;
      builder.set = (values: { cantidadDisponible: () => string }) => {
        suma = values.cantidadDisponible().includes('+');
        return builder;
      };
      builder.where = (_condition: string, params: { insumoId: string }) => {
        id = params.insumoId;
        return builder;
      };
      builder.andWhere = (_condition: string, params: { cantidad: number }) => {
        conGuarda = true;
        cantidad = params.cantidad;
        return builder;
      };
      builder.setParameters = (params: { cantidad: number }) => {
        cantidad = params.cantidad;
        return builder;
      };
      builder.returning = () => builder;
      builder.execute = async () => {
        const disponible = stock.get(id);
        if (disponible === undefined) return { affected: 0, raw: [] };
        if (suma) {
          if (disponible + cantidad > INT_MAX) {
            throw new QueryFailedError('UPDATE', [], { code: '22003' } as never);
          }
          stock.set(id, disponible + cantidad);
        } else {
          if (conGuarda && disponible < cantidad) return { affected: 0, raw: [] };
          stock.set(id, disponible - cantidad);
        }
        return { affected: 1, raw: [{ id, cantidad_disponible: stock.get(id) }] };
      };
      return builder;
    },
    findOneBy: async ({ id }: { id: string }) =>
      stock.has(id) ? { id, cantidadDisponible: stock.get(id) } : null,
  };

  const movimientoRepository = {
    insert: vi.fn(async (row: Record<string, unknown>) => {
      if (control.failInsert) throw new Error('insert falló');
      movimientos.push(row);
    }),
    find: vi.fn(),
  };

  const manager: Record<string, unknown> = {};
  manager.getRepository = (entity: unknown) =>
    entity === Insumo ? insumos : movimientoRepository;
  const transaction = vi.fn(async (work: (m: unknown) => Promise<unknown>) => {
    const stockPrevio = new Map(stock);
    const movimientosPrevios = [...movimientos];
    try {
      return await work(manager);
    } catch (error) {
      stock.clear();
      stockPrevio.forEach((valor, clave) => stock.set(clave, valor));
      movimientos.length = 0;
      movimientos.push(...movimientosPrevios);
      throw error;
    }
  });
  manager.transaction = transaction;

  return { stock, movimientos, control, insumos, movimientoRepository, manager, transaction };
}

describe('InventoryService movimientos', () => {
  let db: ReturnType<typeof createFakeDb>;
  let service: InventoryService;

  beforeEach(() => {
    db = createFakeDb({ 'insumo-1': 10 });
    service = new InventoryService(
      { ...db.insumos, manager: db.manager } as never,
      db.movimientoRepository as never,
      { publish: vi.fn() } as never,
    );
  });

  describe('descontarStock', () => {
    it('registra el movimiento con tipo, cantidad, stock resultante, usuario, origen y motivo', async () => {
      await service.descontarStock({
        insumoId: 'insumo-1',
        cantidad: 3,
        usuarioId: 'user-1',
        origen: OrigenMovimientoInventario.MANUAL,
        motivo: 'Curación',
      });

      expect(db.movimientos).toEqual([
        {
          insumoId: 'insumo-1',
          tipo: TipoMovimientoInventario.DESCUENTO,
          cantidad: 3,
          stockResultante: 7,
          usuarioId: 'user-1',
          origen: OrigenMovimientoInventario.MANUAL,
          referenciaId: null,
          motivo: 'Curación',
        },
      ]);
      expect(db.stock.get('insumo-1')).toBe(7);
    });

    it('abre una transacción propia cuando no recibe manager', async () => {
      await service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 });

      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it('con manager recibido registra en ese manager y no abre otra transacción', async () => {
      await service.descontarStockEnTransaccion(
        {
          insumoId: 'insumo-1',
          cantidad: 2,
          usuarioId: null,
          origen: OrigenMovimientoInventario.ADMINISTRACION_MEDICACION,
          referenciaId: 'adm-1',
        },
        db.manager as never,
      );

      expect(db.transaction).not.toHaveBeenCalled();
      expect(db.movimientos).toEqual([
        {
          insumoId: 'insumo-1',
          tipo: TipoMovimientoInventario.DESCUENTO,
          cantidad: 2,
          stockResultante: 8,
          usuarioId: null,
          origen: OrigenMovimientoInventario.ADMINISTRACION_MEDICACION,
          referenciaId: 'adm-1',
          motivo: null,
        },
      ]);
    });

    it('sin contexto registra origen MANUAL, usuario, referencia y motivo nulos', async () => {
      await service.descontarStock({ insumoId: 'insumo-1', cantidad: 1 });

      expect(db.movimientos[0]).toMatchObject({
        origen: OrigenMovimientoInventario.MANUAL,
        usuarioId: null,
        referenciaId: null,
        motivo: null,
      });
    });

    it.each(['', '   '])('el motivo %j se guarda como null', async (motivo) => {
      await service.descontarStock({ insumoId: 'insumo-1', cantidad: 1, motivo });

      expect(db.movimientos[0]).toMatchObject({ motivo: null });
    });

    it('recorta los espacios del motivo', async () => {
      await service.descontarStock({
        insumoId: 'insumo-1',
        cantidad: 1,
        motivo: '  Uso en sala  ',
      });

      expect(db.movimientos[0]).toMatchObject({ motivo: 'Uso en sala' });
    });

    it('stock insuficiente (409) no registra movimiento ni cambia el stock', async () => {
      await expect(
        service.descontarStock({ insumoId: 'insumo-1', cantidad: 11, usuarioId: 'user-1' }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(db.movimientos).toHaveLength(0);
      expect(db.movimientoRepository.insert).not.toHaveBeenCalled();
      expect(db.stock.get('insumo-1')).toBe(10);
    });

    it('insumo inexistente (404) no registra movimiento', async () => {
      await expect(
        service.descontarStock({ insumoId: 'inexistente', cantidad: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(db.movimientoRepository.insert).not.toHaveBeenCalled();
    });

    it.each([0, -1, 1.5, Number.NaN])(
      'rechaza la cantidad %s sin abrir transacción ni registrar movimiento',
      async (cantidad) => {
        await expect(
          service.descontarStock({ insumoId: 'insumo-1', cantidad }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(db.transaction).not.toHaveBeenCalled();
        expect(db.movimientoRepository.insert).not.toHaveBeenCalled();
      },
    );

    it('si falla el insert del movimiento, el descuento de stock no persiste', async () => {
      db.control.failInsert = true;

      await expect(
        service.descontarStock({ insumoId: 'insumo-1', cantidad: 4 }),
      ).rejects.toThrow('insert falló');

      expect(db.stock.get('insumo-1')).toBe(10);
      expect(db.movimientos).toHaveLength(0);
    });

    it('descuentos sucesivos registran un movimiento cada uno con su stock resultante', async () => {
      await service.descontarStock({ insumoId: 'insumo-1', cantidad: 4 });
      await service.descontarStock({ insumoId: 'insumo-1', cantidad: 6 });

      expect(db.movimientos.map((m) => m.stockResultante)).toEqual([6, 0]);
    });
  });

  describe('reponerStock', () => {
    it('registra el movimiento con tipo, cantidad, stock resultante, usuario, origen y motivo', async () => {
      await service.reponerStock({
        insumoId: 'insumo-1',
        cantidad: 20,
        usuarioId: 'user-2',
        origen: OrigenMovimientoInventario.MANUAL,
        motivo: 'Compra semanal',
      });

      expect(db.movimientos).toEqual([
        {
          insumoId: 'insumo-1',
          tipo: TipoMovimientoInventario.REPOSICION,
          cantidad: 20,
          stockResultante: 30,
          usuarioId: 'user-2',
          origen: OrigenMovimientoInventario.MANUAL,
          referenciaId: null,
          motivo: 'Compra semanal',
        },
      ]);
      expect(db.stock.get('insumo-1')).toBe(30);
    });

    it('siempre abre una transacción propia', async () => {
      await service.reponerStock({ insumoId: 'insumo-1', cantidad: 1 });

      expect(db.transaction).toHaveBeenCalledTimes(1);
    });

    it.each(['', '   '])('el motivo %j se guarda como null', async (motivo) => {
      await service.reponerStock({ insumoId: 'insumo-1', cantidad: 1, motivo });

      expect(db.movimientos[0]).toMatchObject({ motivo: null });
    });

    it('insumo inexistente (404) no registra movimiento', async () => {
      await expect(
        service.reponerStock({ insumoId: 'inexistente', cantidad: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(db.movimientoRepository.insert).not.toHaveBeenCalled();
    });

    it('desborde de la columna (22003 -> 409) no registra movimiento ni cambia el stock', async () => {
      await expect(
        service.reponerStock({ insumoId: 'insumo-1', cantidad: INT_MAX }),
      ).rejects.toBeInstanceOf(ConflictException);

      expect(db.movimientoRepository.insert).not.toHaveBeenCalled();
      expect(db.movimientos).toHaveLength(0);
      expect(db.stock.get('insumo-1')).toBe(10);
    });

    it.each([0, -3, 1.5, Number.NaN])(
      'rechaza la cantidad %s sin abrir transacción',
      async (cantidad) => {
        await expect(
          service.reponerStock({ insumoId: 'insumo-1', cantidad }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(db.transaction).not.toHaveBeenCalled();
      },
    );

    it('si falla el insert del movimiento, la reposición de stock no persiste', async () => {
      db.control.failInsert = true;

      await expect(
        service.reponerStock({ insumoId: 'insumo-1', cantidad: 5 }),
      ).rejects.toThrow('insert falló');

      expect(db.stock.get('insumo-1')).toBe(10);
      expect(db.movimientos).toHaveLength(0);
    });
  });

  describe('listarMovimientos', () => {
    it('devuelve 404 cuando el insumo no existe y no consulta movimientos', async () => {
      await expect(
        service.listarMovimientos('inexistente', { limit: 50, offset: 0 }),
      ).rejects.toBeInstanceOf(NotFoundException);

      expect(db.movimientoRepository.find).not.toHaveBeenCalled();
    });

    it('ordena del más reciente al más antiguo con desempate por id y aplica la paginación', async () => {
      db.movimientoRepository.find.mockResolvedValue([]);

      await service.listarMovimientos('insumo-1', { limit: 20, offset: 40 });

      expect(db.movimientoRepository.find).toHaveBeenCalledWith({
        where: { insumoId: 'insumo-1' },
        order: { createdAt: 'DESC', id: 'DESC' },
        take: 20,
        skip: 40,
      });
    });

    it('mapea los movimientos con la fecha en ISO', async () => {
      db.movimientoRepository.find.mockResolvedValue([
        {
          id: 'mov-1',
          insumoId: 'insumo-1',
          tipo: TipoMovimientoInventario.REPOSICION,
          cantidad: 5,
          stockResultante: 15,
          usuarioId: 'user-1',
          origen: OrigenMovimientoInventario.MANUAL,
          referenciaId: null,
          motivo: 'Compra',
          createdAt: new Date('2026-11-15T14:30:00.000Z'),
        },
      ]);

      await expect(
        service.listarMovimientos('insumo-1', { limit: 50, offset: 0 }),
      ).resolves.toEqual([
        {
          id: 'mov-1',
          tipo: TipoMovimientoInventario.REPOSICION,
          cantidad: 5,
          stockResultante: 15,
          usuarioId: 'user-1',
          origen: OrigenMovimientoInventario.MANUAL,
          referenciaId: null,
          motivo: 'Compra',
          fecha: '2026-11-15T14:30:00.000Z',
        },
      ]);
    });
  });
});
