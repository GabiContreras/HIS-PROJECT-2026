import {
  ExecutionContext,
  INestApplication,
  NotFoundException,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import {
  OrigenMovimientoInventario,
  TipoMovimientoInventario,
} from '../domain/inventory-movement.js';
import { InventoryService } from '../infrastructure/inventory.service.js';
import { InventoryController } from './inventory.controller.js';

describe('InventoryController movimientos integration', () => {
  let app: INestApplication;
  let rolUsuario = RolUsuario.ADMINISTRATIVO;
  let conSesion = true;

  const insumoId = '550e8400-e29b-41d4-a716-446655440000';
  const insumoInexistente = '550e8400-e29b-41d4-a716-446655440001';
  const cuentaId = '9f1c2d3e-4b5a-4c6d-8e7f-0a1b2c3d4e5f';

  const inventoryService = {
    listar: vi.fn(),
    descontarStock: vi.fn(),
    reponerStock: vi.fn(),
    listarMovimientos: vi.fn(),
  };

  const movimiento = {
    id: '7b1f3c52-9d3e-4c63-8a43-0f6a5f2b9c11',
    tipo: TipoMovimientoInventario.DESCUENTO,
    cantidad: 3,
    stockResultante: 7,
    usuarioId: cuentaId,
    origen: OrigenMovimientoInventario.MANUAL,
    referenciaId: null,
    motivo: null,
    fecha: '2026-11-15T14:30:00.000Z',
  };

  beforeEach(async () => {
    rolUsuario = RolUsuario.ADMINISTRATIVO;
    conSesion = true;
    vi.clearAllMocks();
    inventoryService.listarMovimientos.mockResolvedValue([movimiento]);
    inventoryService.descontarStock.mockResolvedValue({
      insumoId,
      cantidadDescontada: 3,
      cantidadRestante: 7,
    });
    inventoryService.reponerStock.mockResolvedValue({
      insumoId,
      cantidadRepuesta: 20,
      cantidadActual: 27,
    });

    const module = await Test.createTestingModule({
      controllers: [InventoryController],
      providers: [{ provide: InventoryService, useValue: inventoryService }],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (!conSesion) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            accountId: cuentaId,
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

  describe('GET /resources/inventory/:id/movimientos', () => {
    it('devuelve el historial al ADMINISTRATIVO con límite 50 y offset 0 por defecto', async () => {
      const response = await request(app.getHttpServer())
        .get(`/resources/inventory/${insumoId}/movimientos`)
        .expect(200);

      expect(response.body).toEqual([movimiento]);
      expect(inventoryService.listarMovimientos).toHaveBeenCalledWith(insumoId, {
        limit: 50,
        offset: 0,
      });
    });

    it('pasa limit y offset al servicio', async () => {
      await request(app.getHttpServer())
        .get(`/resources/inventory/${insumoId}/movimientos?limit=10&offset=20`)
        .expect(200);

      expect(inventoryService.listarMovimientos).toHaveBeenCalledWith(insumoId, {
        limit: 10,
        offset: 20,
      });
    });

    it.each([
      ['limit=1', 1],
      ['limit=100', 100],
    ])('acepta el borde %s', async (query, limit) => {
      await request(app.getHttpServer())
        .get(`/resources/inventory/${insumoId}/movimientos?${query}`)
        .expect(200);

      expect(inventoryService.listarMovimientos).toHaveBeenCalledWith(insumoId, {
        limit,
        offset: 0,
      });
    });

    it.each(['limit=0', 'limit=101', 'limit=-1', 'limit=1.5', 'limit=abc', 'offset=-1', 'offset=1.5', 'offset=abc'])(
      'devuelve 400 con %s',
      async (query) => {
        await request(app.getHttpServer())
          .get(`/resources/inventory/${insumoId}/movimientos?${query}`)
          .expect(400);

        expect(inventoryService.listarMovimientos).not.toHaveBeenCalled();
      },
    );

    it('devuelve 400 con id que no es UUID', async () => {
      await request(app.getHttpServer())
        .get('/resources/inventory/abc/movimientos')
        .expect(400);

      expect(inventoryService.listarMovimientos).not.toHaveBeenCalled();
    });

    it('devuelve 404 cuando el insumo no existe', async () => {
      inventoryService.listarMovimientos.mockRejectedValueOnce(
        new NotFoundException('El insumo no existe'),
      );

      await request(app.getHttpServer())
        .get(`/resources/inventory/${insumoInexistente}/movimientos`)
        .expect(404);
    });

    it.each([RolUsuario.MEDICO, RolUsuario.ENFERMERO])(
      'devuelve 403 para %s',
      async (rol) => {
        rolUsuario = rol;

        await request(app.getHttpServer())
          .get(`/resources/inventory/${insumoId}/movimientos`)
          .expect(403);

        expect(inventoryService.listarMovimientos).not.toHaveBeenCalled();
      },
    );

    it('devuelve 401 sin sesión', async () => {
      conSesion = false;

      await request(app.getHttpServer())
        .get(`/resources/inventory/${insumoId}/movimientos`)
        .expect(401);
    });
  });

  describe('POST /resources/inventory/descontar', () => {
    it('MEDICO descuenta con motivo y se registra su cuenta con origen MANUAL', async () => {
      rolUsuario = RolUsuario.MEDICO;

      await request(app.getHttpServer())
        .post('/resources/inventory/descontar')
        .send({ insumoId, cantidad: 3, motivo: 'Curación' })
        .expect(201);

      expect(inventoryService.descontarStock).toHaveBeenCalledWith({
        insumoId,
        cantidad: 3,
        motivo: 'Curación',
        usuarioId: cuentaId,
        origen: OrigenMovimientoInventario.MANUAL,
      });
    });

    it('sin motivo responde igual que antes', async () => {
      rolUsuario = RolUsuario.MEDICO;

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

    it('acepta un motivo vacío', async () => {
      rolUsuario = RolUsuario.MEDICO;

      await request(app.getHttpServer())
        .post('/resources/inventory/descontar')
        .send({ insumoId, cantidad: 3, motivo: '' })
        .expect(201);
    });

    it('acepta un motivo de exactamente 200 caracteres', async () => {
      rolUsuario = RolUsuario.MEDICO;

      await request(app.getHttpServer())
        .post('/resources/inventory/descontar')
        .send({ insumoId, cantidad: 3, motivo: 'a'.repeat(200) })
        .expect(201);
    });

    it.each([
      ['de más de 200 caracteres', 'a'.repeat(201)],
      ['que no es texto', 123],
    ])('devuelve 400 con motivo %s', async (_descripcion, motivo) => {
      rolUsuario = RolUsuario.MEDICO;

      await request(app.getHttpServer())
        .post('/resources/inventory/descontar')
        .send({ insumoId, cantidad: 3, motivo })
        .expect(400);

      expect(inventoryService.descontarStock).not.toHaveBeenCalled();
    });

    it.each([RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO])(
      'devuelve 403 para %s',
      async (rol) => {
        rolUsuario = rol;

        await request(app.getHttpServer())
          .post('/resources/inventory/descontar')
          .send({ insumoId, cantidad: 1 })
          .expect(403);
      },
    );

    it('devuelve 401 sin sesión', async () => {
      conSesion = false;

      await request(app.getHttpServer())
        .post('/resources/inventory/descontar')
        .send({ insumoId, cantidad: 1 })
        .expect(401);
    });
  });

  describe('POST /resources/inventory/:id/reponer', () => {
    it('ADMINISTRATIVO repone con motivo y se registra su cuenta con origen MANUAL', async () => {
      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send({ cantidad: 20, motivo: 'Compra semanal' })
        .expect(201);

      expect(inventoryService.reponerStock).toHaveBeenCalledWith({
        insumoId,
        cantidad: 20,
        motivo: 'Compra semanal',
        usuarioId: cuentaId,
        origen: OrigenMovimientoInventario.MANUAL,
      });
    });

    it('sin motivo responde igual que antes', async () => {
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

    it('acepta un motivo vacío', async () => {
      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send({ cantidad: 20, motivo: '' })
        .expect(201);
    });

    it.each([
      ['de más de 200 caracteres', 'a'.repeat(201)],
      ['que no es texto', 123],
    ])('devuelve 400 con motivo %s', async (_descripcion, motivo) => {
      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send({ cantidad: 20, motivo })
        .expect(400);

      expect(inventoryService.reponerStock).not.toHaveBeenCalled();
    });

    it('devuelve 401 sin sesión', async () => {
      conSesion = false;

      await request(app.getHttpServer())
        .post(`/resources/inventory/${insumoId}/reponer`)
        .send({ cantidad: 20 })
        .expect(401);
    });
  });
});
