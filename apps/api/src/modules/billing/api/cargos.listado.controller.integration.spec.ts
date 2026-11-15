import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { Cargo, EstadoCargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { Insumo } from '../../../entities/insumo.entity.js';
import { AdministracionMedicacion } from '../../../entities/administracion-medicacion.entity.js';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { BillingService } from '../application/billing.service.js';
import { NomencladorService } from '../application/nomenclador.service.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';
import { CargosController } from './cargos.controller.js';

const PACIENTE_ID = '550e8400-e29b-41d4-a716-446655440001';

function cargo(id: string, cambios: Partial<Cargo> = {}): Cargo {
  return {
    id,
    turnoId: null,
    administrationId: null,
    internacionId: null,
    concepto: null,
    importePesos: 15000,
    tipoAtencion: TipoAtencionFacturable.REGULAR,
    tipoCobertura: null,
    entidadCobertura: null,
    importePacientePesos: null,
    importeTerceroPesos: null,
    estado: EstadoCargo.PENDIENTE,
    createdAt: new Date('2026-03-10T15:30:00.000Z'),
    ...cambios,
  } as Cargo;
}

function leerBytes(
  res: NodeJS.ReadableStream,
  callback: (error: Error | null, body: Buffer) => void,
) {
  const partes: Buffer[] = [];
  res.on('data', (parte: Buffer) => partes.push(Buffer.from(parte)));
  res.on('end', () => callback(null, Buffer.concat(partes)));
}

describe('GET /billing/cargos (paginacion, filtros y exportacion)', () => {
  let app: INestApplication;
  let rol: RolUsuario | null;
  let almacenados: Cargo[];
  let consultas: Array<{
    andWhere: ReturnType<typeof vi.fn>;
    offset: ReturnType<typeof vi.fn>;
    limit: ReturnType<typeof vi.fn>;
  }>;

  beforeEach(async () => {
    rol = RolUsuario.ADMINISTRATIVO;
    almacenados = [];
    consultas = [];

    const cargosRepository = {
      createQueryBuilder: vi.fn(() => {
        let desplazamiento = 0;
        let tope: number | undefined;
        const consulta = {
          andWhere: vi.fn().mockReturnThis(),
          orderBy: vi.fn().mockReturnThis(),
          addOrderBy: vi.fn().mockReturnThis(),
          addSelect: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          groupBy: vi.fn().mockReturnThis(),
          offset: vi.fn((valor: number) => {
            desplazamiento = valor;
            return consulta;
          }),
          limit: vi.fn((valor: number) => {
            tope = valor;
            return consulta;
          }),
          getMany: vi.fn(async () => almacenados.slice(desplazamiento, desplazamiento + (tope ?? Infinity))),
          getCount: vi.fn(async () => almacenados.length),
          getRawAndEntities: vi.fn(async () => ({
            entities: almacenados.slice(0, tope ?? Infinity),
            raw: almacenados.slice(0, tope ?? Infinity).map(() => ({ cursor_creado: 'x' })),
          })),
          getRawMany: vi.fn(async () => [
            { tipoCobertura: 'PARTICULAR', cantidad: '1', totalPesos: '15000', pacientePesos: '15000', terceroPesos: '0' },
          ]),
        };
        consultas.push(consulta);
        return consulta;
      }),
    };

    const module = await Test.createTestingModule({
      controllers: [CargosController],
      providers: [
        BillingService,
        { provide: NomencladorService, useValue: {} },
        { provide: ConsultaRegularStrategy, useValue: {} },
        { provide: ConsultaUrgenciaStrategy, useValue: {} },
        { provide: getRepositoryToken(Cargo), useValue: cargosRepository },
        { provide: getRepositoryToken(Turno), useValue: { find: vi.fn(async () => []) } },
        { provide: getRepositoryToken(Insumo), useValue: {} },
        { provide: getRepositoryToken(AdministracionMedicacion), useValue: {} },
        { provide: getRepositoryToken(Paciente), useValue: {} },
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

  const rutas = ['/billing/cargos', '/billing/cargos/exportar'];

  it.each(rutas)('GET %s responde 401 sin sesion', async (ruta) => {
    rol = null;

    await request(app.getHttpServer()).get(ruta).expect(401);
  });

  it.each(rutas.flatMap((ruta) => [RolUsuario.MEDICO, RolUsuario.ENFERMERO].map((r) => [ruta, r] as const)))(
    'GET %s responde 403 para %s',
    async (ruta, rolDenegado) => {
      rol = rolDenegado;

      await request(app.getHttpServer()).get(ruta).expect(403);
    },
  );

  describe('listado', () => {
    it('responde la pagina por defecto con limit 50 y offset 0', async () => {
      almacenados = [cargo('a'), cargo('b')];

      const { body } = await request(app.getHttpServer()).get('/billing/cargos').expect(200);

      expect(body).toMatchObject({ total: 2, limit: 50, offset: 0 });
      expect(body.items.map((item: { id: string }) => item.id)).toEqual(['a', 'b']);
      expect(consultas[0].limit).toHaveBeenCalledWith(50);
      expect(consultas[0].offset).toHaveBeenCalledWith(0);
    });

    it('respeta limit y offset recibidos', async () => {
      almacenados = Array.from({ length: 10 }, (_, i) => cargo(`c${i}`));

      const { body } = await request(app.getHttpServer())
        .get('/billing/cargos?limit=3&offset=4')
        .expect(200);

      expect(body).toMatchObject({ total: 10, limit: 3, offset: 4 });
      expect(body.items.map((item: { id: string }) => item.id)).toEqual(['c4', 'c5', 'c6']);
    });

    it('acepta los bordes limit 1 y limit 100 y offset 0', async () => {
      await request(app.getHttpServer()).get('/billing/cargos?limit=1&offset=0').expect(200);
      await request(app.getHttpServer()).get('/billing/cargos?limit=100').expect(200);
    });

    it('una pagina mas alla del total viene vacia con el total correcto', async () => {
      almacenados = [cargo('a')];

      const { body } = await request(app.getHttpServer())
        .get('/billing/cargos?offset=500')
        .expect(200);

      expect(body).toEqual({ items: [], total: 1, limit: 50, offset: 500 });
    });

    it.each([
      'limit=0',
      'limit=-1',
      'limit=101',
      'limit=abc',
      'limit=1.5',
      'offset=-1',
      'offset=abc',
      'estado=PAGADA',
      'tipoAtencion=OTRO',
      'pacienteId=no-es-uuid',
      'desde=10/03/2026',
      'hasta=2026-3-1',
      'desde=2026-02-30',
      'hasta=2026-13-01',
      'desde=2026-03-12&hasta=2026-03-10',
    ])('responde 400 con %s', async (query) => {
      await request(app.getHttpServer()).get(`/billing/cargos?${query}`).expect(400);
    });

    it('pasa los filtros recibidos al armado de la consulta', async () => {
      await request(app.getHttpServer())
        .get(
          `/billing/cargos?desde=2026-03-01&hasta=2026-03-31&pacienteId=${PACIENTE_ID}&estado=PAGADO&tipoAtencion=FARMACIA`,
        )
        .expect(200);

      expect(consultas[0].andWhere).toHaveBeenCalledTimes(5);
      expect(consultas[0].andWhere).toHaveBeenCalledWith('c.estado = :estado', { estado: 'PAGADO' });
      expect(consultas[0].andWhere).toHaveBeenCalledWith('c.tipoAtencion = :tipoAtencion', {
        tipoAtencion: 'FARMACIA',
      });
    });
  });

  describe('exportacion', () => {
    const pedirCsv = (query = '') =>
      request(app.getHttpServer())
        .get(`/billing/cargos/exportar${query}`)
        .buffer(true)
        .parse(leerBytes as never);

    it('responde CSV y no confunde exportar con un id', async () => {
      const respuesta = await pedirCsv().expect(200);

      expect(respuesta.headers['content-type']).toBe('text/csv; charset=utf-8');
    });

    it('descarga como adjunto con el nombre cargos-AAAA-MM-DD.csv', async () => {
      const respuesta = await pedirCsv().expect(200);

      expect(respuesta.headers['content-disposition']).toMatch(
        /^attachment; filename="cargos-\d{4}-\d{2}-\d{2}\.csv"$/,
      );
    });

    it('empieza con BOM UTF-8, tiene la cabecera y termina cada fila en CRLF', async () => {
      almacenados = [cargo('a', { concepto: 'Insumos, "varios"' }), cargo('b')];

      const respuesta = await pedirCsv().expect(200);

      const bytes = respuesta.body as Buffer;
      expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
      const texto = bytes.toString('utf8');
      expect(texto.startsWith('﻿id,fecha,tipoAtencion,estado,concepto,')).toBe(true);
      const lineas = texto.split('\r\n');
      expect(lineas).toHaveLength(4);
      expect(lineas[3]).toBe('');
      expect(lineas[1]).toBe(
        'a,2026-03-10T15:30:00.000Z,REGULAR,PENDIENTE,"Insumos, ""varios""",15000,,,,,',
      );
    });

    it('exporta todo lo filtrado sin offset y con los mismos filtros del listado', async () => {
      almacenados = Array.from({ length: 120 }, (_, i) => cargo(`c${i}`));

      const respuesta = await pedirCsv(
        `?estado=PENDIENTE&tipoAtencion=REGULAR&pacienteId=${PACIENTE_ID}&desde=2026-03-01&hasta=2026-03-31&limit=1&offset=5`,
      ).expect(200);

      const filas = (respuesta.body as Buffer).toString('utf8').split('\r\n').filter(Boolean);
      expect(filas).toHaveLength(121);
      expect(consultas[0].andWhere).toHaveBeenCalledTimes(5);
      expect(consultas[0].offset).not.toHaveBeenCalled();
    });

    it.each(['estado=PAGADA', 'tipoAtencion=OTRO', 'pacienteId=x', 'desde=ayer', 'desde=2026-03-12&hasta=2026-03-10'])(
      'responde 400 con %s antes de transmitir',
      async (query) => {
        await request(app.getHttpServer()).get(`/billing/cargos/exportar?${query}`).expect(400);
      },
    );
  });

  it('GET /billing/cargos/resumen sigue respondiendo el resumen por cobertura', async () => {
    const { body } = await request(app.getHttpServer()).get('/billing/cargos/resumen').expect(200);

    expect(body).toEqual([
      { tipoCobertura: 'PARTICULAR', cantidad: 1, totalPesos: 15000, pacientePesos: 15000, terceroPesos: 0 },
    ]);
  });
});
