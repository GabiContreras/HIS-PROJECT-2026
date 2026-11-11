import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { IndicacionesService } from '../application/indicaciones.service.js';
import { IndicacionesController } from './indicaciones.controller.js';

const PACIENTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const INSUMO_ID = '550e8400-e29b-41d4-a716-446655440001';
const INDICACION_ID = '550e8400-e29b-41d4-a716-446655440002';
const ROL_HEADER = 'x-test-rol';
const TODOS_LOS_ROLES: readonly RolUsuario[] = Object.values(RolUsuario);

const INDICACION = { pacienteId: PACIENTE_ID, insumoId: INSUMO_ID, dosis: '400 mg', frecuenciaHoras: 8 };

describe('IndicacionesController: autorización por rol y validación de entrada', () => {
  let app: INestApplication;

  const service = {
    crear: vi.fn(async () => ({ id: INDICACION_ID })),
    listar: vi.fn(async () => []),
    administrar: vi.fn(async () => ({ id: 'administracion-1' })),
  };

  const authGuardFalso = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
      const rol = req.headers[ROL_HEADER];
      if (!rol) throw new UnauthorizedException('Sin sesión.');
      req.user = { accountId: 'cuenta-test', sessionId: 'sesion-test', rol, esSuperadmin: false };
      return true;
    },
  };

  const endpoints = [
    {
      nombre: 'POST /indicaciones (crear)',
      metodo: 'post',
      ruta: '/indicaciones',
      body: INDICACION,
      ok: 201,
      caso: 'crear',
      permitidos: [RolUsuario.MEDICO],
    },
    {
      nombre: 'GET /indicaciones (listar)',
      metodo: 'get',
      ruta: '/indicaciones',
      ok: 200,
      caso: 'listar',
      permitidos: [RolUsuario.ENFERMERO, RolUsuario.MEDICO],
    },
    {
      nombre: 'POST /indicaciones/:id/administraciones',
      metodo: 'post',
      ruta: `/indicaciones/${INDICACION_ID}/administraciones`,
      body: {},
      ok: 201,
      caso: 'administrar',
      permitidos: [RolUsuario.ENFERMERO],
    },
  ] as const;

  function llamar(metodo: 'get' | 'post', ruta: string, rol?: RolUsuario, body?: object) {
    let req = request(app.getHttpServer())[metodo](ruta);
    if (rol) req = req.set(ROL_HEADER, rol);
    return body ? req.send(body) : req;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [IndicacionesController],
      providers: [{ provide: IndicacionesService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuardFalso)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe.each(endpoints)('$nombre', (endpoint) => {
    const body = 'body' in endpoint ? endpoint.body : undefined;
    const permitidos = endpoint.permitidos as readonly RolUsuario[];
    const noPermitidos = TODOS_LOS_ROLES.filter((rol) => !permitidos.includes(rol));

    it.each(permitidos)('permite a %s y ejecuta el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(endpoint.ok);
      expect(service[endpoint.caso]).toHaveBeenCalledTimes(1);
    });

    it.each(noPermitidos)('rechaza a %s con 403 sin ejecutar el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(403);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });

    it('rechaza sin sesión con 401 sin ejecutar el caso de uso', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, undefined, body).expect(401);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });
  });

  describe('validación de entrada', () => {
    it('acepta una indicación sin fecha de fin (no vence)', async () => {
      await llamar('post', '/indicaciones', RolUsuario.MEDICO, INDICACION).expect(201);
    });

    it.each([
      ['pacienteId que no es UUID', { pacienteId: 'paciente-1' }],
      ['insumoId que no es UUID', { insumoId: 'insumo-1' }],
      ['dosis vacía', { dosis: '' }],
      ['dosis de más de 50 caracteres', { dosis: 'x'.repeat(51) }],
      ['frecuencia menor a 1 hora', { frecuenciaHoras: 0 }],
      ['frecuencia mayor a 168 horas', { frecuenciaHoras: 169 }],
      ['frecuencia no entera', { frecuenciaHoras: 7.5 }],
      ['fecha de fin que no es una fecha', { fechaFin: 'mañana' }],
    ])('rechaza una indicación con %s', async (_motivo, cambio) => {
      await llamar('post', '/indicaciones', RolUsuario.MEDICO, { ...INDICACION, ...cambio }).expect(400);
      expect(service.crear).not.toHaveBeenCalled();
    });

    it('rechaza una indicación a la que le falta un campo obligatorio', async () => {
      const { insumoId: _insumoId, ...incompleta } = INDICACION;
      await llamar('post', '/indicaciones', RolUsuario.MEDICO, incompleta).expect(400);
      expect(service.crear).not.toHaveBeenCalled();
    });

    it('rechaza el filtro pacienteId que no es UUID', async () => {
      await llamar('get', '/indicaciones?pacienteId=abc', RolUsuario.ENFERMERO).expect(400);
      expect(service.listar).not.toHaveBeenCalled();
    });

    it('rechaza administrar una indicación cuyo id no es UUID', async () => {
      await llamar('post', '/indicaciones/no-es-uuid/administraciones', RolUsuario.ENFERMERO, {}).expect(400);
      expect(service.administrar).not.toHaveBeenCalled();
    });

    it('rechaza observaciones de más de 500 caracteres', async () => {
      await llamar('post', `/indicaciones/${INDICACION_ID}/administraciones`, RolUsuario.ENFERMERO, {
        observaciones: 'x'.repeat(501),
      }).expect(400);
      expect(service.administrar).not.toHaveBeenCalled();
    });
  });

  describe('delegación al caso de uso', () => {
    it('crea la indicación a nombre del médico de la sesión', async () => {
      await llamar('post', '/indicaciones', RolUsuario.MEDICO, INDICACION).expect(201);
      expect(service.crear).toHaveBeenCalledWith(
        expect.objectContaining(INDICACION),
        expect.objectContaining({ accountId: 'cuenta-test', rol: RolUsuario.MEDICO }),
      );
    });

    it('pasa el pacienteId del filtro a la consulta', async () => {
      await llamar('get', `/indicaciones?pacienteId=${PACIENTE_ID}`, RolUsuario.ENFERMERO).expect(200);
      expect(service.listar).toHaveBeenCalledWith(PACIENTE_ID);
    });

    it('confirma la dosis a nombre del enfermero de la sesión, con sus observaciones', async () => {
      await llamar('post', `/indicaciones/${INDICACION_ID}/administraciones`, RolUsuario.ENFERMERO, {
        observaciones: 'Paciente refiere dolor leve.',
      }).expect(201);
      expect(service.administrar).toHaveBeenCalledWith(
        INDICACION_ID,
        expect.objectContaining({ observaciones: 'Paciente refiere dolor leve.' }),
        expect.objectContaining({ accountId: 'cuenta-test', rol: RolUsuario.ENFERMERO }),
      );
    });
  });
});
