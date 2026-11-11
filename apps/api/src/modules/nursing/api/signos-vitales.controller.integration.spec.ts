import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { SignosVitalesService } from '../application/signos-vitales.service.js';
import { TipoSignoVital } from '../domain/vital-sign-rules.js';
import { SignosVitalesController } from './signos-vitales.controller.js';

const PACIENTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const ROL_HEADER = 'x-test-rol';

const PERMITIDOS = [RolUsuario.ENFERMERO, RolUsuario.MEDICO];
const NO_PERMITIDOS = Object.values(RolUsuario).filter((rol) => !PERMITIDOS.includes(rol));

const CONTROL = { pacienteId: PACIENTE_ID, sistolica: 120, diastolica: 80, frecuenciaCardiaca: 76, temperatura: 36.8 };
const SIGNO = { pacienteId: PACIENTE_ID, tipo: TipoSignoVital.TEMPERATURA, valor: 36.8 };

describe('SignosVitalesController: autorización por rol y validación de entrada', () => {
  let app: INestApplication;

  const service = {
    tipos: vi.fn(() => []),
    listar: vi.fn(async () => []),
    registrar: vi.fn(async () => ({ id: 'signo-1' })),
    listarControles: vi.fn(async () => []),
    registrarControl: vi.fn(async () => ({ id: 'control-1' })),
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
    { nombre: 'GET /signos-vitales/tipos', metodo: 'get', ruta: '/signos-vitales/tipos', ok: 200, caso: 'tipos' },
    { nombre: 'GET /signos-vitales', metodo: 'get', ruta: '/signos-vitales', ok: 200, caso: 'listar' },
    { nombre: 'GET /signos-vitales/controles', metodo: 'get', ruta: '/signos-vitales/controles', ok: 200, caso: 'listarControles' },
    { nombre: 'POST /signos-vitales', metodo: 'post', ruta: '/signos-vitales', body: SIGNO, ok: 201, caso: 'registrar' },
    { nombre: 'POST /signos-vitales/controles', metodo: 'post', ruta: '/signos-vitales/controles', body: CONTROL, ok: 201, caso: 'registrarControl' },
  ] as const;

  function llamar(metodo: 'get' | 'post', ruta: string, rol?: RolUsuario, body?: object) {
    let req = request(app.getHttpServer())[metodo](ruta);
    if (rol) req = req.set(ROL_HEADER, rol);
    return body ? req.send(body) : req;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [SignosVitalesController],
      providers: [{ provide: SignosVitalesService, useValue: service }],
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

    it.each(PERMITIDOS)('permite a %s y ejecuta el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(endpoint.ok);
      expect(service[endpoint.caso]).toHaveBeenCalledTimes(1);
    });

    it.each(NO_PERMITIDOS)('rechaza a %s con 403 sin ejecutar el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(403);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });

    it('rechaza sin sesión con 401 sin ejecutar el caso de uso', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, undefined, body).expect(401);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });
  });

  describe('validación de entrada', () => {
    it('rechaza un control con pacienteId que no es UUID', async () => {
      await llamar('post', '/signos-vitales/controles', RolUsuario.ENFERMERO, { ...CONTROL, pacienteId: 'paciente-1' }).expect(400);
      expect(service.registrarControl).not.toHaveBeenCalled();
    });

    it('rechaza un control al que le falta un valor', async () => {
      const { temperatura: _temperatura, ...incompleto } = CONTROL;
      await llamar('post', '/signos-vitales/controles', RolUsuario.ENFERMERO, incompleto).expect(400);
      expect(service.registrarControl).not.toHaveBeenCalled();
    });

    it('rechaza un control con un valor no numérico', async () => {
      await llamar('post', '/signos-vitales/controles', RolUsuario.ENFERMERO, { ...CONTROL, temperatura: 'alta' }).expect(400);
      expect(service.registrarControl).not.toHaveBeenCalled();
    });

    it('rechaza un signo vital de un tipo que no existe', async () => {
      await llamar('post', '/signos-vitales', RolUsuario.ENFERMERO, { ...SIGNO, tipo: 'COLESTEROL' }).expect(400);
      expect(service.registrar).not.toHaveBeenCalled();
    });

    it('rechaza el filtro pacienteId que no es UUID', async () => {
      await llamar('get', '/signos-vitales?pacienteId=abc', RolUsuario.MEDICO).expect(400);
      expect(service.listar).not.toHaveBeenCalled();
    });
  });

  describe('delegación al caso de uso', () => {
    it('pasa el pacienteId del filtro a la consulta', async () => {
      await llamar('get', `/signos-vitales/controles?pacienteId=${PACIENTE_ID}`, RolUsuario.MEDICO).expect(200);
      expect(service.listarControles).toHaveBeenCalledWith(PACIENTE_ID);
    });

    it('registra el control a nombre del usuario de la sesión', async () => {
      await llamar('post', '/signos-vitales/controles', RolUsuario.ENFERMERO, CONTROL).expect(201);
      expect(service.registrarControl).toHaveBeenCalledWith(
        expect.objectContaining(CONTROL),
        expect.objectContaining({ accountId: 'cuenta-test', rol: RolUsuario.ENFERMERO }),
      );
    });
  });
});
