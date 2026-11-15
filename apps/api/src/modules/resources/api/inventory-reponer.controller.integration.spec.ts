import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { Insumo } from '../../../entities/insumo.entity.js';
import { MovimientoInventario } from '../../../entities/movimiento-inventario.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController reponer integration', () => {
  let app: INestApplication;
  let rolUsuario = RolUsuario.ADMINISTRATIVO;

  const insumoId = '550e8400-e29b-41d4-a716-446655440000';
  const insumoInexistente = '550e8400-e29b-41d4-a716-446655440001';

  const queryBuilder = {
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    setParameters: vi.fn(),
    returning: vi.fn(),
    execute: vi.fn(),
  };

  const repository = {
    createQueryBuilder: vi.fn(() => queryBuilder),
  };

  const movimientoRepository = { insert: vi.fn().mockResolvedValue(undefined), find: vi.fn() };
  const manager: Record<string, unknown> = {};
  manager.getRepository = vi.fn((entity: unknown) =>
    entity === Insumo ? repository : movimientoRepository,
  );
  manager.transaction = vi.fn((work: (m: unknown) => unknown) => work(manager));
  Object.assign(repository, { manager });

  beforeEach(async () => {
    rolUsuario = RolUsuario.ADMINISTRATIVO;
    vi.clearAllMocks();
    Object.values(queryBuilder).forEach((method) => {
      method.mockReturnValue(queryBuilder);
    });
    queryBuilder.execute.mockResolvedValue({
      affected: 1,
      raw: [{ id: insumoId, cantidad_disponible: 27 }],
    });

    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Insumo), useValue: repository },
        { provide: getRepositoryToken(MovimientoInventario), useValue: movimientoRepository },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          context.switchToHttp().getRequest().user = {
            accountId: 'test-account',
            sessionId: 'test-session',
            rol: rolUsuario,
            esSuperadmin: false,
          };
          return true;
        },
      })
      .compile();

    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /resources/inventory/:id/reponer', () => {
    it('repone stock y responde 201 con el saldo actual', async () => {
      const response = await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send({ cantidad: 20 })
        .expect(201);

      expect(response.body).toEqual({
        insumoId,
        cantidadRepuesta: 20,
        cantidadActual: 27,
      });
    });

    it.each([
      [{ cantidad: 0 }],
      [{ cantidad: -5 }],
      [{ cantidad: 1.5 }],
      [{ cantidad: 10001 }],
      [{ cantidad: '3' }],
      [{}],
    ])('devuelve 400 con cuerpo invalido %j', async (body) => {
      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send(body)
        .expect(400);

      expect(queryBuilder.execute).not.toHaveBeenCalled();
    });

    it('devuelve 400 con id que no es UUID', async () => {
      await request(app.getHttpServer())
        .post('/resources/inventory/abc/reponer')
        .send({ cantidad: 5 })
        .expect(400);
    });

    it('devuelve 404 cuando el insumo no existe', async () => {
      queryBuilder.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoInexistente}/reponer`)
        .send({ cantidad: 5 })
        .expect(404);
    });

    it('devuelve 409 cuando la suma supera el rango de la columna', async () => {
      queryBuilder.execute.mockRejectedValueOnce(
        new QueryFailedError('UPDATE', [], { code: '22003' } as never),
      );

      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send({ cantidad: 10000 })
        .expect(409);
    });

    it.each([RolUsuario.MEDICO, RolUsuario.ENFERMERO])(
      'devuelve 403 para %s',
      async (rol) => {
        rolUsuario = rol;

        await request(app.getHttpServer())
          .post(`/resources/inventory/${insumoId}/reponer`)
          .send({ cantidad: 5 })
          .expect(403);

        expect(queryBuilder.execute).not.toHaveBeenCalled();
      },
    );
  });
});
