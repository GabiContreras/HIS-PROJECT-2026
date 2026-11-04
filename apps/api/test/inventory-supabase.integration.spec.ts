
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DataSource } from 'typeorm';
import { randomUUID } from 'node:crypto';
import { Insumo } from '../src/entities/insumo.entity.js';
import { InventoryService } from '../src/modules/resources/infrastructure/inventory.service.js';

const ejecutarIntegracionSupabase =
  process.env.RUN_SUPABASE_INTEGRATION === 'true';

describe.skipIf(!ejecutarIntegracionSupabase)(
  'InventoryService - integración Supabase',
  () => {
    let dataSource: DataSource;

    beforeAll(async () => {
      const databaseUrl = process.env.DATABASE_URL;

      if (!databaseUrl) {
        throw new Error('Falta DATABASE_URL');
      }

      const databaseHost = new URL(databaseUrl).hostname;

      if (
        databaseHost !== 'aws-0-us-east-1.pooler.supabase.com'
      ) {
        throw new Error(
          `Host de base de datos no autorizado: ${databaseHost}`,
        );
      }

      dataSource = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        entities: [Insumo],
        synchronize: false,
        ssl: { rejectUnauthorized: false },
      });

      await dataSource.initialize();

      const runner = dataSource.createQueryRunner();

      try {
        const resultado = await runner.query(`
          SELECT current_database() AS name,
                 current_schema() AS schema
        `);

        if (
          resultado[0].name !== 'postgres' ||
          resultado[0].schema !== 'public'
        ) {
          throw new Error(
            'La conexión no apunta a la base y esquema esperados.',
          );
        }
      } catch (error) {
        await dataSource.destroy();
        throw error;
      } finally {
        await runner.release();
      }
    });

    afterAll(async () => {
      if (dataSource?.isInitialized) {
        await dataSource.destroy();
      }
    });

    it('descuenta stock dentro de una transacción y revierte el cambio', async () => {
      const runner = dataSource.createQueryRunner();

      await runner.connect();
      await runner.startTransaction();

      try {
        const insumoId = randomUUID();
        const nombrePrueba = `Prueba integración ${insumoId}`;

        await runner.query(
          `INSERT INTO public.insumos
            (id, nombre, unidad_medida, cantidad_disponible)
           VALUES ($1, $2, $3, $4)`,
          [insumoId, nombrePrueba, 'unidad', 5],
        );

        const service = new InventoryService(
          runner.manager.getRepository(Insumo),
        );

        const resultado = await service.descontarStock({
          insumoId,
          cantidad: 2,
        });
        expect(resultado.cantidadRestante).toBe(3);

        const consulta = await runner.query(
          `SELECT cantidad_disponible
           FROM public.insumos
           WHERE id = $1`,
          [insumoId],
        );

        expect(consulta).toHaveLength(1);
        expect(Number(consulta[0].cantidad_disponible)).toBe(3);
      } finally {
        try {
          if (runner.isTransactionActive) {
            await runner.rollbackTransaction();
          }
        } finally {
          await runner.release();
        }
      }
    });
  },
);
