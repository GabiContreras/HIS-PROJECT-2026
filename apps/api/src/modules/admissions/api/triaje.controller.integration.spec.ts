import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { TriageService } from '../application/triage.service.js';
import { TriajeController } from './triaje.controller.js';

const UUID = '550e8400-e29b-41d4-a716-446655440000';
const ROL_HEADER = 'x-test-rol';

const TRIAJE = { pacienteId: UUID, nivel: 'ROJO', motivoConsulta: 'Dolor precordial' };

describe('TriajeController: autorización por rol y validación de entrada', () => {
  let app: INestApplication;

  const service = {
    registrarTriage: vi.fn(async () => ({ id: 't1' })),
    obtenerCola: vi.fn(async () => []),
    atender: vi.fn(async () => ({ id: 't1' })),
  };

  // Reemplaza solo la autenticación; el RolesGuard es el real.
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
      nombre: 'POST /triaje',
      metodo: 'post',
      ruta: '/triaje',
      body: TRIAJE,
      ok: 201,
      caso: 'registrarTriage',
      permitidos: [RolUsuario.ENFERMERO, RolUsuario.MEDICO],
    },
    {
      nombre: 'GET /triaje',
      metodo: 'get',
      ruta: '/triaje',
      ok: 200,
      caso: 'obtenerCola',
      permitidos: [RolUsuario.ENFERMERO, RolUsuario.MEDICO, RolUsuario.ADMINISTRATIVO],
    },
    {
      nombre: 'PATCH /triaje/:id/atender',
      metodo: 'patch',
      ruta: `/triaje/${UUID}/atender`,
      ok: 200,
      caso: 'atender',
      permitidos: [RolUsuario.MEDICO],
    },
  ] as const;

  function llamar(metodo: 'get' | 'post' | 'patch', ruta: string, rol?: RolUsuario, body?: object) {
    let req = request(app.getHttpServer())[metodo](ruta);
    if (rol) req = req.set(ROL_HEADER, rol);
    return body ? req.send(body) : req;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [TriajeController],
      providers: [{ provide: TriageService, useValue: service }],
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
    const permitidos: readonly RolUsuario[] = endpoint.permitidos;
    const noPermitidos = Object.values(RolUsuario).filter((rol) => !permitidos.includes(rol));

    it.each(permitidos)('permite a %s y ejecuta el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(endpoint.ok);
      expect(service[endpoint.caso]).toHaveBeenCalledTimes(1);
    });

    it.each(noPermitidos)('rechaza a %s con 403 sin ejecutar el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(403);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });

    it('rechaza sin sesión con 401', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, undefined, body).expect(401);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });
  });

  describe('validación de entrada', () => {
    it('toma la cuenta que registra desde la sesión', async () => {
      await llamar('post', '/triaje', RolUsuario.ENFERMERO, TRIAJE).expect(201);
      expect(service.registrarTriage).toHaveBeenCalledWith(expect.objectContaining(TRIAJE), 'cuenta-test');
    });

    it.each([
      ['pacienteId que no es UUID', { ...TRIAJE, pacienteId: 'paciente-1' }],
      ['nivel inexistente', { ...TRIAJE, nivel: 'NEGRO' }],
      ['motivo vacío', { ...TRIAJE, motivoConsulta: '' }],
      ['medicoDestinoId que no es UUID', { ...TRIAJE, medicoDestinoId: 'medico-1' }],
    ])('rechaza con 400: %s', async (_caso, body) => {
      await llamar('post', '/triaje', RolUsuario.ENFERMERO, body).expect(400);
      expect(service.registrarTriage).not.toHaveBeenCalled();
    });

    it('rechaza con 400 un id que no es UUID al atender', async () => {
      await llamar('patch', '/triaje/abc/atender', RolUsuario.MEDICO).expect(400);
      expect(service.atender).not.toHaveBeenCalled();
    });
  });
});
