import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Cargo, EstadoCargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { Financiador } from '../../../entities/financiador.entity.js';
import { Liquidacion } from '../../../entities/liquidacion.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { LiquidacionesService } from '../application/liquidaciones.service.js';
import { LiquidacionesController } from './liquidaciones.controller.js';

const FINANCIADOR_ID = '550e8400-e29b-41d4-a716-446655440010';
const INEXISTENTE_ID = '550e8400-e29b-41d4-a716-4466554400ff';
const LIQUIDACION_ID = '550e8400-e29b-41d4-a716-446655440020';
const ACCOUNT_ID = '550e8400-e29b-41d4-a716-446655440030';

function liquidacionGuardada(id: string): Liquidacion {
  return {
    id,
    financiadorId: FINANCIADOR_ID,
    financiador: { nombre: 'Obra Social Ejemplo' },
    periodoDesde: '2026-03-01',
    periodoHasta: '2026-03-31',
    cantidadCargos: 2,
    totalPesos: 24_000,
    usuarioId: ACCOUNT_ID,
    createdAt: new Date('2026-04-01T13:00:00.000Z'),
  } as Liquidacion;
}

describe('/billing/liquidaciones', () => {
  let app: INestApplication;
  let rol: RolUsuario | null;
  let filasActualizadas: Array<{ id: string; importeTerceroPesos: number }>;
  let financiadorExiste: boolean;
  let guardadas: Liquidacion[];
  let consultas: Array<{ sql: string; params: unknown[] }>;
  let almacenadas: Liquidacion[];
  let cargosDeLiquidacion: Cargo[];
  let builders: Array<{ andWhere: ReturnType<typeof vi.fn>; offset: ReturnType<typeof vi.fn>; limit: ReturnType<typeof vi.fn> }>;

  beforeEach(async () => {
    rol = RolUsuario.ADMINISTRATIVO;
    filasActualizadas = [
      { id: 'c1', importeTerceroPesos: 12_000 },
      { id: 'c2', importeTerceroPesos: 12_000 },
    ];
    financiadorExiste = true;
    guardadas = [];
    consultas = [];
    almacenadas = [];
    cargosDeLiquidacion = [];
    builders = [];

    const manager = {
      getRepository: (entidad: unknown) =>
        entidad === Financiador
          ? {
              findOne: vi.fn(async () =>
                financiadorExiste ? { id: FINANCIADOR_ID, nombre: 'Obra Social Ejemplo', activo: false } : null,
              ),
            }
          : {
              create: (datos: Partial<Liquidacion>) => ({ ...datos }) as Liquidacion,
              save: vi.fn(async (liquidacion: Liquidacion) => {
                if (!liquidacion.id) {
                  liquidacion.id = LIQUIDACION_ID;
                  liquidacion.createdAt = new Date('2026-04-01T13:00:00.000Z');
                }
                guardadas.push({ ...liquidacion });
                return liquidacion;
              }),
            },
      query: vi.fn(async (sql: string, params: unknown[]) => {
        consultas.push({ sql, params });
        return filasActualizadas;
      }),
    };

    const liquidacionesRepository = {
      manager: { transaction: vi.fn(async (trabajo: (m: unknown) => unknown) => trabajo(manager)) },
      findOne: vi.fn(async ({ where }: { where: { id: string } }) =>
        almacenadas.find((l) => l.id === where.id) ?? null,
      ),
      createQueryBuilder: vi.fn(() => {
        let desplazamiento = 0;
        let tope: number | undefined;
        const builder = {
          innerJoinAndSelect: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          addOrderBy: vi.fn().mockReturnThis(),
          offset: vi.fn((valor: number) => {
            desplazamiento = valor;
            return builder;
          }),
          limit: vi.fn((valor: number) => {
            tope = valor;
            return builder;
          }),
          getMany: vi.fn(async () => almacenadas.slice(desplazamiento, desplazamiento + (tope ?? Infinity))),
          getCount: vi.fn(async () => almacenadas.length),
        };
        builders.push(builder);
        return builder;
      }),
    };
    const cargosRepository = { find: vi.fn(async () => cargosDeLiquidacion) };

    const module = await Test.createTestingModule({
      controllers: [LiquidacionesController],
      providers: [
        LiquidacionesService,
        { provide: getRepositoryToken(Liquidacion), useValue: liquidacionesRepository },
        { provide: getRepositoryToken(Cargo), useValue: cargosRepository },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (rol === null) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            accountId: ACCOUNT_ID,
            sessionId: 'test-session',
            rol,
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

  const cuerpo = { financiadorId: FINANCIADOR_ID, desde: '2026-03-01', hasta: '2026-03-31' };

  const pedidos: Array<[string, (a: INestApplication) => request.Test]> = [
    ['POST /billing/liquidaciones', (a) => request(a.getHttpServer()).post('/billing/liquidaciones').send(cuerpo)],
    ['GET /billing/liquidaciones', (a) => request(a.getHttpServer()).get('/billing/liquidaciones')],
    [
      'GET /billing/liquidaciones/:id',
      (a) => request(a.getHttpServer()).get(`/billing/liquidaciones/${LIQUIDACION_ID}`),
    ],
  ];

  it.each(pedidos)('%s responde 401 sin sesion', async (_nombre, pedir) => {
    rol = null;

    await pedir(app).expect(401);
  });

  it.each(
    pedidos.flatMap(([nombre, pedir]) =>
      [RolUsuario.MEDICO, RolUsuario.ENFERMERO].map((r) => [nombre, pedir, r] as const),
    ),
  )('%s responde 403 para %s', async (_nombre, pedir, rolDenegado) => {
    rol = rolDenegado;

    await pedir(app).expect(403);

    expect(consultas).toHaveLength(0);
  });

  describe('POST', () => {
    it('responde 201 con la liquidacion creada y registra al usuario autenticado', async () => {
      const { body } = await request(app.getHttpServer()).post('/billing/liquidaciones').send(cuerpo).expect(201);

      expect(body).toEqual({
        id: LIQUIDACION_ID,
        financiadorId: FINANCIADOR_ID,
        financiadorNombre: 'Obra Social Ejemplo',
        desde: '2026-03-01',
        hasta: '2026-03-31',
        cantidadCargos: 2,
        totalPesos: 24_000,
        usuarioId: ACCOUNT_ID,
        createdAt: '2026-04-01T13:00:00.000Z',
      });
      expect(guardadas[0].usuarioId).toBe(ACCOUNT_ID);
    });

    it('calcula el periodo en hora de Buenos Aires', async () => {
      await request(app.getHttpServer()).post('/billing/liquidaciones').send(cuerpo).expect(201);

      expect(consultas[0].params[3]).toEqual(new Date('2026-03-01T03:00:00.000Z'));
      expect(consultas[0].params[4]).toEqual(new Date('2026-04-01T03:00:00.000Z'));
    });

    it('responde 409 si no hay cargos para liquidar', async () => {
      filasActualizadas = [];

      const { body } = await request(app.getHttpServer()).post('/billing/liquidaciones').send(cuerpo).expect(409);

      expect(body.message).toContain('No hay cargos para liquidar');
    });

    it('responde 404 si el financiador no existe', async () => {
      financiadorExiste = false;

      await request(app.getHttpServer())
        .post('/billing/liquidaciones')
        .send({ ...cuerpo, financiadorId: INEXISTENTE_ID })
        .expect(404);
    });

    it.each([
      ['sin cuerpo', {}],
      ['sin financiadorId', { desde: '2026-03-01', hasta: '2026-03-31' }],
      ['sin desde', { financiadorId: FINANCIADOR_ID, hasta: '2026-03-31' }],
      ['sin hasta', { financiadorId: FINANCIADOR_ID, desde: '2026-03-01' }],
      ['financiadorId invalido', { ...cuerpo, financiadorId: 'abc' }],
      ['formato de fecha invalido', { ...cuerpo, desde: '01/03/2026' }],
      ['fecha imposible', { ...cuerpo, hasta: '2026-02-30' }],
      ['mes inexistente', { ...cuerpo, desde: '2026-13-01' }],
      ['desde posterior a hasta', { ...cuerpo, desde: '2026-03-31', hasta: '2026-03-01' }],
    ])('responde 400 %s y no consulta cargos', async (_nombre, body) => {
      await request(app.getHttpServer()).post('/billing/liquidaciones').send(body).expect(400);

      expect(consultas).toHaveLength(0);
    });
  });

  describe('GET listado', () => {
    beforeEach(() => {
      almacenadas = [liquidacionGuardada('l1'), liquidacionGuardada('l2'), liquidacionGuardada('l3')];
    });

    it('responde la pagina por defecto con limit 50 y offset 0', async () => {
      const { body } = await request(app.getHttpServer()).get('/billing/liquidaciones').expect(200);

      expect(body).toMatchObject({ total: 3, limit: 50, offset: 0 });
      expect(body.items.map((i: { id: string }) => i.id)).toEqual(['l1', 'l2', 'l3']);
      expect(body.items[0]).toMatchObject({ financiadorNombre: 'Obra Social Ejemplo', desde: '2026-03-01' });
      expect(builders[0].limit).toHaveBeenCalledWith(50);
      expect(builders[0].offset).toHaveBeenCalledWith(0);
    });

    it('respeta limit y offset', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/billing/liquidaciones?limit=1&offset=1')
        .expect(200);

      expect(body).toMatchObject({ total: 3, limit: 1, offset: 1 });
      expect(body.items.map((i: { id: string }) => i.id)).toEqual(['l2']);
    });

    it('filtra por financiador', async () => {
      await request(app.getHttpServer()).get(`/billing/liquidaciones?financiadorId=${FINANCIADOR_ID}`).expect(200);

      expect(builders[0].andWhere).toHaveBeenCalledWith('l.financiadorId = :financiadorId', {
        financiadorId: FINANCIADOR_ID,
      });
    });

    it.each(['limit=0', 'limit=101', 'limit=abc', 'offset=-1', 'offset=1.5', 'financiadorId=abc'])(
      'responde 400 con %s',
      async (query) => {
        await request(app.getHttpServer()).get(`/billing/liquidaciones?${query}`).expect(400);
      },
    );
  });

  describe('GET detalle', () => {
    it('responde 200 con la liquidacion y sus cargos', async () => {
      almacenadas = [liquidacionGuardada(LIQUIDACION_ID)];
      cargosDeLiquidacion = [
        {
          id: 'c1',
          concepto: null,
          tipoAtencion: TipoAtencionFacturable.REGULAR,
          createdAt: new Date('2026-03-10T15:30:00.000Z'),
          importePesos: 15_000,
          importeTerceroPesos: 12_000,
          estado: EstadoCargo.FACTURADO,
        } as Cargo,
      ];

      const { body } = await request(app.getHttpServer())
        .get(`/billing/liquidaciones/${LIQUIDACION_ID}`)
        .expect(200);

      expect(body.id).toBe(LIQUIDACION_ID);
      expect(body.cargos).toEqual([
        {
          id: 'c1',
          concepto: null,
          tipoAtencion: 'REGULAR',
          createdAt: '2026-03-10T15:30:00.000Z',
          importePesos: 15_000,
          importeTerceroPesos: 12_000,
        },
      ]);
    });

    it('responde 404 si no existe', async () => {
      await request(app.getHttpServer()).get(`/billing/liquidaciones/${INEXISTENTE_ID}`).expect(404);
    });

    it('responde 400 si el id no es un UUID', async () => {
      await request(app.getHttpServer()).get('/billing/liquidaciones/abc').expect(400);
    });
  });

  it.each(['put', 'patch', 'delete'] as const)('no existe %s sobre una liquidacion', async (metodo) => {
    await request(app.getHttpServer())[metodo](`/billing/liquidaciones/${LIQUIDACION_ID}`).expect(404);
  });
});
