import {
  ExecutionContext,
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Cargo } from '../../../entities/cargo.entity.js';
import { MovimientoInventario } from '../../../entities/movimiento-inventario.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { CamasService } from '../../resources/application/camas.service.js';
import { ReportesService } from '../application/reportes.service.js';
import { ReportesController } from './reportes.controller.js';

type Raw = Record<string, string | null>;

function chainableQb(rows: Raw[], one?: Raw) {
  const qb: Record<string, unknown> = {};
  for (const method of [
    'where',
    'andWhere',
    'select',
    'addSelect',
    'leftJoin',
    'innerJoin',
    'groupBy',
    'addGroupBy',
    'orderBy',
    'setParameter',
    'setParameters',
  ]) {
    qb[method] = vi.fn(() => qb);
  }
  qb.getRawMany = vi.fn(async () => rows);
  qb.getRawOne = vi.fn(async () => one);
  return qb;
}

describe('ReportesController integration', () => {
  let app: INestApplication;
  let rol: RolUsuario | null;
  let cargosRows: Raw[];
  let movimientosRows: Raw[];

  const cargosRepository = {
    createQueryBuilder: vi.fn(),
  };
  const movimientosRepository = {
    createQueryBuilder: vi.fn(),
  };
  const camas = {
    ocupacion: vi.fn(async () => ({
      camasActivas: 20,
      camasOcupadas: 14,
      porcentajeOcupacion: 70,
    })),
  };

  beforeEach(async () => {
    rol = RolUsuario.ADMINISTRATIVO;
    cargosRows = [];
    movimientosRows = [];
    vi.clearAllMocks();
    cargosRepository.createQueryBuilder.mockImplementation(() => {
      const esAnulados = cargosRepository.createQueryBuilder.mock.calls.length % 2 === 0;
      return esAnulados
        ? chainableQb([], { cantidad: '1', totalPesos: '8000' })
        : chainableQb(cargosRows);
    });
    movimientosRepository.createQueryBuilder.mockImplementation(() =>
      chainableQb(movimientosRows),
    );

    const module = await Test.createTestingModule({
      controllers: [ReportesController],
      providers: [
        ReportesService,
        { provide: getRepositoryToken(Cargo), useValue: cargosRepository },
        { provide: getRepositoryToken(MovimientoInventario), useValue: movimientosRepository },
        { provide: CamasService, useValue: camas },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({
        canActivate: (context: ExecutionContext) => {
          if (rol === null) throw new UnauthorizedException();
          context.switchToHttp().getRequest().user = {
            accountId: 'test-account',
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

  const rutasConPeriodo = [
    '/billing/reportes/cargos-por-periodo',
    '/billing/reportes/cargos-por-medico',
    '/billing/reportes/cargos-por-servicio',
    '/billing/reportes/consumo-insumos',
  ];
  const todasLasRutas = [...rutasConPeriodo, '/billing/reportes/ocupacion-camas'];
  const periodo = 'desde=2026-03-01&hasta=2026-03-31';

  it.each(todasLasRutas)('GET %s responde 401 sin sesión', async (ruta) => {
    rol = null;

    await request(app.getHttpServer()).get(`${ruta}?${periodo}`).expect(401);
  });

  it.each(
    todasLasRutas.flatMap((ruta) =>
      [RolUsuario.MEDICO, RolUsuario.ENFERMERO].map((r) => [ruta, r] as const),
    ),
  )('GET %s responde 403 para %s', async (ruta, rolDenegado) => {
    rol = rolDenegado;

    await request(app.getHttpServer()).get(`${ruta}?${periodo}`).expect(403);
  });

  it.each(rutasConPeriodo)('GET %s responde 400 si faltan desde y hasta', async (ruta) => {
    await request(app.getHttpServer()).get(ruta).expect(400);
    await request(app.getHttpServer()).get(`${ruta}?desde=2026-03-01`).expect(400);
    await request(app.getHttpServer()).get(`${ruta}?hasta=2026-03-31`).expect(400);
  });

  it.each(rutasConPeriodo)('GET %s responde 400 ante fechas inválidas', async (ruta) => {
    await request(app.getHttpServer())
      .get(`${ruta}?desde=01-03-2026&hasta=2026-03-31`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`${ruta}?desde=2026-02-30&hasta=2026-03-31`)
      .expect(400);
    await request(app.getHttpServer())
      .get(`${ruta}?desde=2026-03-31&hasta=2026-03-01`)
      .expect(400);
  });

  it('GET cargos-por-periodo responde 400 con una agrupación inválida', async () => {
    await request(app.getHttpServer())
      .get(`/billing/reportes/cargos-por-periodo?${periodo}&agrupacion=semana`)
      .expect(400);
  });

  it('GET cargos-por-periodo responde 200 con agrupación por defecto día', async () => {
    cargosRows = [
      { periodo: '2026-03-10', cantidad: '2', totalPesos: '30000', pacientePesos: '6000', terceroPesos: '24000' },
    ];

    const response = await request(app.getHttpServer())
      .get(`/billing/reportes/cargos-por-periodo?${periodo}`)
      .expect(200);

    expect(response.body).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      agrupacion: 'dia',
      totales: { cantidad: 2, totalPesos: 30000, pacientePesos: 6000, terceroPesos: 24000 },
      anulados: { cantidad: 1, totalPesos: 8000 },
      filas: [
        { periodo: '2026-03-10', cantidad: 2, totalPesos: 30000, pacientePesos: 6000, terceroPesos: 24000 },
      ],
    });
  });

  it('GET cargos-por-periodo acepta agrupacion=mes', async () => {
    const response = await request(app.getHttpServer())
      .get(`/billing/reportes/cargos-por-periodo?${periodo}&agrupacion=mes`)
      .expect(200);

    expect(response.body.agrupacion).toBe('mes');
  });

  it('GET cargos-por-medico responde 200 con la fila "Sin médico asignado"', async () => {
    cargosRows = [
      { medicoId: null, nombre: null, apellido: null, cantidad: '1', totalPesos: '2000', pacientePesos: '0', terceroPesos: '0' },
      { medicoId: 'med-1', nombre: 'Ana', apellido: 'Gómez', cantidad: '1', totalPesos: '15000', pacientePesos: '3000', terceroPesos: '12000' },
    ];

    const response = await request(app.getHttpServer())
      .get(`/billing/reportes/cargos-por-medico?${periodo}`)
      .expect(200);

    expect(response.body.filas.map((fila: { medico: string }) => fila.medico)).toEqual([
      'Ana Gómez',
      'Sin médico asignado',
    ]);
    expect(response.body.totales.totalPesos).toBe(17000);
  });

  it('GET cargos-por-servicio responde 200 y período vacío devuelve ceros y filas []', async () => {
    const response = await request(app.getHttpServer())
      .get(`/billing/reportes/cargos-por-servicio?${periodo}`)
      .expect(200);

    expect(response.body.filas).toEqual([]);
    expect(response.body.totales).toEqual({
      cantidad: 0,
      totalPesos: 0,
      pacientePesos: 0,
      terceroPesos: 0,
    });
  });

  it('GET ocupacion-camas responde 200 con lo que entrega CamasService', async () => {
    const response = await request(app.getHttpServer())
      .get('/billing/reportes/ocupacion-camas')
      .expect(200);

    expect(response.body).toEqual({
      camasActivas: 20,
      camasOcupadas: 14,
      porcentajeOcupacion: 70,
    });
    expect(camas.ocupacion).toHaveBeenCalledTimes(1);
  });

  it('GET consumo-insumos responde 200 con el desglose', async () => {
    movimientosRows = [
      { insumoId: 'i-1', nombre: 'Paracetamol', unidadMedida: 'comprimido', cantidadTotal: '25', cantidadManual: '5', cantidadMedicacion: '20' },
    ];

    const response = await request(app.getHttpServer())
      .get(`/billing/reportes/consumo-insumos?${periodo}`)
      .expect(200);

    expect(response.body).toEqual({
      desde: '2026-03-01',
      hasta: '2026-03-31',
      filas: [
        { insumoId: 'i-1', nombre: 'Paracetamol', unidadMedida: 'comprimido', cantidadTotal: 25, cantidadManual: 5, cantidadMedicacion: 20 },
      ],
    });
  });
});
