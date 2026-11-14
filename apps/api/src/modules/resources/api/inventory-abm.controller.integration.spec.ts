import { ExecutionContext, INestApplication, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { Insumo } from '../../../entities/insumo.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController ABM integration', () => {
  let app: INestApplication;
  let rolUsuario = RolUsuario.ADMINISTRATIVO;

  const insumoId = '550e8400-e29b-41d4-a716-446655440000';
  const insumoInexistente = '550e8400-e29b-41d4-a716-446655440001';

  const queryBuilder = {
    update: vi.fn(),
    set: vi.fn(),
    where: vi.fn(),
    returning: vi.fn(),
    execute: vi.fn(),
  };

  const repository = {
    create: vi.fn((data: object) => ({ ...data })),
    save: vi.fn(async (data: object) => ({ id: insumoId, ...data })),
    createQueryBuilder: vi.fn(() => queryBuilder),
  };

  beforeEach(async () => {
    rolUsuario = RolUsuario.ADMINISTRATIVO;
    vi.clearAllMocks();
    Object.values(queryBuilder).forEach((method) => {
      method.mockReturnValue(queryBuilder);
    });
    queryBuilder.execute.mockResolvedValue({
      affected: 1,
      raw: [
        {
          id: insumoId,
          nombre: 'Gasa',
          unidad_medida: 'caja',
          cantidad_disponible: 8,
          precio_pesos: 300,
          stock_minimo: 5,
        },
      ],
    });

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
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe('POST /resources/inventory', () => {
    it('crea un insumo con stock 0', async () => {
      const response = await request(app.getHttpServer())
        .post('/resources/inventory')
        .send({ nombre: 'Gasa', unidadMedida: 'caja', precioPesos: 300, stockMinimo: 5 })
        .expect(201);

      expect(response.body).toEqual({
        id: insumoId,
        nombre: 'Gasa',
        unidadMedida: 'caja',
        cantidadDisponible: 0,
        precioPesos: 300,
        stockMinimo: 5,
      });
    });

    it('ignora cantidadDisponible enviada por el cliente', async () => {
      const response = await request(app.getHttpServer())
        .post('/resources/inventory')
        .send({ nombre: 'Gasa', unidadMedida: 'caja', cantidadDisponible: 50 })
        .expect(201);

      expect(response.body.cantidadDisponible).toBe(0);
    });

    it.each([RolUsuario.MEDICO, RolUsuario.ENFERMERO])(
      'devuelve 403 para %s',
      async (rol) => {
        rolUsuario = rol;

        await request(app.getHttpServer())
          .post('/resources/inventory')
          .send({ nombre: 'Gasa', unidadMedida: 'caja' })
          .expect(403);
      },
    );

    it.each([
      [{ unidadMedida: 'caja' }],
      [{ nombre: 'Gasa' }],
      [{ nombre: '   ', unidadMedida: 'caja' }],
      [{ nombre: 'Gasa', unidadMedida: 'caja', precioPesos: -1 }],
      [{ nombre: 'Gasa', unidadMedida: 'caja', precioPesos: 1.5 }],
      [{ nombre: 'Gasa', unidadMedida: 'caja', stockMinimo: -1 }],
      [{ nombre: 'x'.repeat(151), unidadMedida: 'caja' }],
      [{ nombre: 'Gasa', unidadMedida: 'x'.repeat(21) }],
    ])('devuelve 400 con datos invalidos %j', async (body) => {
      await request(app.getHttpServer())
        .post('/resources/inventory')
        .send(body)
        .expect(400);
    });

    it('devuelve 409 cuando el nombre ya existe', async () => {
      repository.save.mockRejectedValueOnce(
        new QueryFailedError('INSERT', [], { code: '23505' } as never),
      );

      await request(app.getHttpServer())
        .post('/resources/inventory')
        .send({ nombre: 'Gasa', unidadMedida: 'caja' })
        .expect(409);
    });
  });

  describe('PATCH /resources/inventory/:id', () => {
    it('actualiza precio, unidad y stock minimo', async () => {
      const response = await request(app.getHttpServer())
        .patch(`/resources/inventory/${insumoId}`)
        .send({ precioPesos: 300, unidadMedida: 'caja', stockMinimo: 5 })
        .expect(200);

      expect(response.body).toEqual({
        id: insumoId,
        nombre: 'Gasa',
        unidadMedida: 'caja',
        cantidadDisponible: 8,
        precioPesos: 300,
        stockMinimo: 5,
      });
    });

    it('no permite cambiar nombre ni stock disponible', async () => {
      await request(app.getHttpServer())
        .patch(`/resources/inventory/${insumoId}`)
        .send({ nombre: 'Otro', cantidadDisponible: 99, precioPesos: 300 })
        .expect(200);

      expect(queryBuilder.set).toHaveBeenCalledWith({ precioPesos: 300 });
    });

    it('devuelve 400 sin campos editables', async () => {
      await request(app.getHttpServer())
        .patch(`/resources/inventory/${insumoId}`)
        .send({ nombre: 'Otro' })
        .expect(400);
    });

    it('devuelve 400 con id que no es UUID', async () => {
      await request(app.getHttpServer())
        .patch('/resources/inventory/abc')
        .send({ precioPesos: 1 })
        .expect(400);
    });

    it('devuelve 400 con precio negativo', async () => {
      await request(app.getHttpServer())
        .patch(`/resources/inventory/${insumoId}`)
        .send({ precioPesos: -5 })
        .expect(400);
    });

    it('devuelve 404 cuando el insumo no existe', async () => {
      queryBuilder.execute.mockResolvedValueOnce({ affected: 0, raw: [] });

      await request(app.getHttpServer())
        .patch(`/resources/inventory/${insumoInexistente}`)
        .send({ precioPesos: 10 })
        .expect(404);
    });

    it.each([RolUsuario.MEDICO, RolUsuario.ENFERMERO])(
      'devuelve 403 para %s',
      async (rol) => {
        rolUsuario = rol;

        await request(app.getHttpServer())
          .patch(`/resources/inventory/${insumoId}`)
          .send({ precioPesos: 10 })
          .expect(403);
      },
    );
  });
});
