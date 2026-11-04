
import {  ExecutionContext,INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Insumo } from '../../../entities/insumo.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { InventoryController } from './inventory.controller.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';

describe('InventoryController integration', () => {
  let app: INestApplication;
  let rolUsuario = RolUsuario.MEDICO;

  const insumoId = '550e8400-e29b-41d4-a716-446655440000';
  const insumoInexistente = '550e8400-e29b-41d4-a716-446655440001';
  const stock = new Map<string, number>();

  const repository = {
    createQueryBuilder: vi.fn(() => {
      let id = '';
      let cantidad = 0;

      const builder = {
        update: vi.fn(() => builder),
        set: vi.fn(() => builder),
        where: vi.fn((_condition: string, params: { insumoId: string }) => {
          id = params.insumoId;
          return builder;
        }),
        andWhere: vi.fn((_condition: string, params: { cantidad: number }) => {
          cantidad = params.cantidad;
          return builder;
        }),
        setParameters: vi.fn(() => builder),
        returning: vi.fn(() => builder),
        execute: vi.fn(async () => {
          const disponible = stock.get(id);

          if (disponible === undefined || disponible < cantidad) {
            return { affected: 0, raw: [] };
          }

          const restante = disponible - cantidad;
          stock.set(id, restante);

          return {
            affected: 1,
            raw: [{ id, cantidad_disponible: restante }],
          };
        }),
      };

      return builder;
    }),
    findOneBy: vi.fn(async ({ id }: { id: string }) => {
      const disponible = stock.get(id);

      return disponible === undefined
        ? null
        : ({ id, cantidadDisponible: disponible } as Insumo);
    }),
  };

  beforeEach(async () => {
    rolUsuario = RolUsuario.MEDICO;
    stock.clear();
    stock.set(insumoId, 10);
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [
        InventoryService,
        { provide: getRepositoryToken(Insumo), useValue: repository },
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
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('descuenta stock y devuelve el saldo restante por HTTP', async () => {
    const response = await request(app.getHttpServer())
      .post('/resources/inventory/descontar')
      .send({ insumoId, cantidad: 3 })
      .expect(201);

    expect(response.body).toEqual({
      insumoId,
      cantidadDescontada: 3,
      cantidadRestante: 7,
    });
  });
  it('devuelve 403 cuando el usuario no es MEDICO', async () => {
  rolUsuario = RolUsuario.ENFERMERO;

  await request(app.getHttpServer())
    .post('/resources/inventory/descontar')
    .send({ insumoId, cantidad: 1 })
    .expect(403);
});

  it('devuelve 404 cuando el insumo no existe', async () => {
    await request(app.getHttpServer())
      .post('/resources/inventory/descontar')
      .send({ insumoId: insumoInexistente, cantidad: 1 })
      .expect(404);
  });

  it('devuelve 409 cuando no hay stock suficiente', async () => {
    await request(app.getHttpServer())
      .post('/resources/inventory/descontar')
      .send({ insumoId, cantidad: 20 })
      .expect(409);
  });

  it('rechaza cantidades no válidas', async () => {
    await request(app.getHttpServer())
      .post('/resources/inventory/descontar')
      .send({ insumoId, cantidad: 0 })
      .expect(400);
  });

  it('rechaza un ID que no tenga formato UUID', async () => {
    await request(app.getHttpServer())
      .post('/resources/inventory/descontar')
      .send({ insumoId: 'insumo-1', cantidad: 1 })
      .expect(400);
  });
});
