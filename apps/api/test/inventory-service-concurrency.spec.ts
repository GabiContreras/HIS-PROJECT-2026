
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { Insumo } from '../src/entities/insumo.entity.js';
import { InventoryService } from '../src/modules/resources/infrastructure/inventory.service.js';

describe('InventoryService - concurrencia real en PostgreSQL local', () => {
  let dataSource: DataSource;
  let service: InventoryService;
  let insumoId: string;

  beforeAll(async () => {
    const password = process.env.PGLOCAL_PASSWORD;

    if (!password) {
      throw new Error('Falta PGLOCAL_PASSWORD');
    }

    dataSource = new DataSource({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password,
      database: 'his_test',
      entities: [Insumo],
      synchronize: false,
      ssl: false,
    });

    await dataSource.initialize();

    const database = await dataSource.query(
      'SELECT current_database() AS name',
    );

    if (database[0].name !== 'his_test') {
      throw new Error('La prueba solo puede ejecutarse en his_test');
    }

    service = new InventoryService(dataSource.getRepository(Insumo));

    const insumo = await dataSource.getRepository(Insumo).findOneBy({
      nombre: 'Insumo prueba concurrencia',
    });

    if (!insumo) {
      throw new Error('No se encontró el insumo de prueba');
    }

    insumoId = insumo.id;
  });

  afterAll(async () => {
    if (dataSource?.isInitialized) {
      await dataSource.destroy();
    }
  });

  it('permite solo 10 descuentos de 20 intentos simultáneos', async () => {
    const repository = dataSource.getRepository(Insumo);

    await repository.update(
      { id: insumoId },
      { cantidadDisponible: 10 },
    );

    const resultados = await Promise.allSettled(
      Array.from({ length: 20 }, () =>
        service.descontarStock({
          insumoId,
          cantidad: 1,
        }),
      ),
    );

    const exitosos = resultados.filter(
      (resultado) => resultado.status === 'fulfilled',
    ).length;

    const rechazados = resultados.filter(
      (resultado) => resultado.status === 'rejected',
    );

    const stockFinal = await repository.findOneBy({ id: insumoId });

    expect(exitosos).toBe(10);
    expect(rechazados).toHaveLength(10);
    expect(
      rechazados.every(
        (resultado) =>
          resultado.status === 'rejected' &&
          resultado.reason instanceof Error &&
          resultado.reason.message ===
            'Insumo inexistente o stock insuficiente',
      ),
    ).toBe(true);
    expect(stockFinal?.cantidadDisponible).toBe(0);
  });
});
