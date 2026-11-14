import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthService } from '../application/auth.service.js';
import { AccountAdminService } from './account-admin.service.js';
import { AuthGuard } from './auth.guard.js';
import { UsuariosController } from './usuarios.controller.js';

const ID = '550e8400-e29b-41d4-a716-446655440000';
const ROL_HEADER = 'x-test-rol';
const SUPERADMIN_HEADER = 'x-test-superadmin';

type Metodo = 'get' | 'post' | 'patch';
interface Actor {
  nombre: string;
  rol?: RolUsuario;
  superadmin?: boolean;
}

const SIN_SESION: Actor = { nombre: 'sin sesión' };
const MEDICO: Actor = { nombre: 'MEDICO', rol: RolUsuario.MEDICO };
const ENFERMERO: Actor = { nombre: 'ENFERMERO', rol: RolUsuario.ENFERMERO };
const ADMINISTRATIVO: Actor = { nombre: 'ADMINISTRATIVO', rol: RolUsuario.ADMINISTRATIVO };
const SUPERADMIN: Actor = { nombre: 'superadmin', rol: RolUsuario.ADMINISTRATIVO, superadmin: true };

const STAFF = { nombre: 'Ada', apellido: 'Lovelace', email: 'ada@ejemplo.com', password: 'ClaveSegura135', rol: RolUsuario.MEDICO };
const ADMIN = { nombre: 'María', apellido: 'González', email: 'maria@ejemplo.com', password: 'ClaveSegura135' };

describe('UsuariosController: autorización por rol y por superadmin', () => {
  let app: INestApplication;

  // Los casos de uso se simulan: acá se prueba la capa HTTP (guards, pipes y delegación).
  const cuenta = { id: ID };
  const accounts = {
    createAdministrator: vi.fn(async () => cuenta),
    list: vi.fn(async () => [cuenta]),
    get: vi.fn(async () => cuenta),
    updateProfile: vi.fn(async () => cuenta),
    updateSchedule: vi.fn(async () => cuenta),
    enableDoctor: vi.fn(async () => cuenta),
    deactivate: vi.fn(async () => cuenta),
    dispose: vi.fn(async () => cuenta),
    restore: vi.fn(async () => cuenta),
  };
  const auth = { register: vi.fn(async () => ({ message: 'ok' })) };

  // Reemplaza solo la autenticación. RolesGuard y SuperadminGuard son los reales.
  const authGuardFalso = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
      const rol = req.headers[ROL_HEADER];
      if (!rol) throw new UnauthorizedException('Sin sesión.');
      req.user = {
        accountId: 'cuenta-test',
        sessionId: 'sesion-test',
        rol,
        esSuperadmin: req.headers[SUPERADMIN_HEADER] === 'true',
      };
      return true;
    },
  };

  function llamar(metodo: Metodo, ruta: string, actor: Actor, body?: object) {
    let req = request(app.getHttpServer())[metodo](ruta);
    if (actor.rol) req = req.set(ROL_HEADER, actor.rol);
    if (actor.superadmin) req = req.set(SUPERADMIN_HEADER, 'true');
    return body ? req.send(body) : req;
  }

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [UsuariosController],
      providers: [
        { provide: AccountAdminService, useValue: accounts },
        { provide: AuthService, useValue: auth },
      ],
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

  // Endpoints de administración común: cualquier ADMINISTRATIVO (el superadmin también lo es).
  const deAdministrativo = [
    { nombre: 'POST /usuarios', metodo: 'post', ruta: '/usuarios', body: STAFF, ok: 201, caso: () => auth.register },
    { nombre: 'GET /usuarios', metodo: 'get', ruta: '/usuarios', ok: 200, caso: () => accounts.list },
    { nombre: 'GET /usuarios/:id', metodo: 'get', ruta: `/usuarios/${ID}`, ok: 200, caso: () => accounts.get },
    { nombre: 'PATCH /usuarios/:id', metodo: 'patch', ruta: `/usuarios/${ID}`, body: { nombre: 'Ada' }, ok: 200, caso: () => accounts.updateProfile },
    {
      nombre: 'PATCH /usuarios/:id/horario',
      metodo: 'patch',
      ruta: `/usuarios/${ID}/horario`,
      body: { horaInicio: '08:00', horaFin: '16:00' },
      ok: 200,
      caso: () => accounts.updateSchedule,
    },
    { nombre: 'PATCH /usuarios/:id/habilitar', metodo: 'patch', ruta: `/usuarios/${ID}/habilitar`, ok: 200, caso: () => accounts.enableDoctor },
    { nombre: 'PATCH /usuarios/:id/deshabilitar', metodo: 'patch', ruta: `/usuarios/${ID}/deshabilitar`, ok: 200, caso: () => accounts.deactivate },
  ] as const;

  describe.each(deAdministrativo)('$nombre', (endpoint) => {
    const body = 'body' in endpoint ? endpoint.body : undefined;

    it.each([ADMINISTRATIVO, SUPERADMIN])('permite a $nombre', async (actor) => {
      await llamar(endpoint.metodo, endpoint.ruta, actor, body).expect(endpoint.ok);
      expect(endpoint.caso()).toHaveBeenCalledTimes(1);
    });

    it.each([MEDICO, ENFERMERO])('rechaza a $nombre con 403 sin ejecutar el caso de uso', async (actor) => {
      await llamar(endpoint.metodo, endpoint.ruta, actor, body).expect(403);
      expect(endpoint.caso()).not.toHaveBeenCalled();
    });

    it('rechaza sin sesión con 401', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, SIN_SESION, body).expect(401);
      expect(endpoint.caso()).not.toHaveBeenCalled();
    });
  });

  // Operaciones raíz: solo el superadmin; un administrativo común recibe 403.
  const deSuperadmin = [
    { nombre: 'POST /usuarios/administrativos', metodo: 'post', ruta: '/usuarios/administrativos', body: ADMIN, ok: 201, caso: () => accounts.createAdministrator },
    { nombre: 'PATCH /usuarios/:id/baja', metodo: 'patch', ruta: `/usuarios/${ID}/baja`, ok: 200, caso: () => accounts.dispose },
    { nombre: 'PATCH /usuarios/:id/restaurar', metodo: 'patch', ruta: `/usuarios/${ID}/restaurar`, ok: 200, caso: () => accounts.restore },
  ] as const;

  describe.each(deSuperadmin)('$nombre', (endpoint) => {
    const body = 'body' in endpoint ? endpoint.body : undefined;

    it('permite al superadmin', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, SUPERADMIN, body).expect(endpoint.ok);
      expect(endpoint.caso()).toHaveBeenCalledTimes(1);
    });

    it.each([ADMINISTRATIVO, MEDICO, ENFERMERO])('rechaza a $nombre con 403 sin ejecutar el caso de uso', async (actor) => {
      await llamar(endpoint.metodo, endpoint.ruta, actor, body).expect(403);
      expect(endpoint.caso()).not.toHaveBeenCalled();
    });

    it('rechaza sin sesión con 401', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, SIN_SESION, body).expect(401);
      expect(endpoint.caso()).not.toHaveBeenCalled();
    });
  });

  describe('delegación', () => {
    it('pasa la identidad autenticada a los casos de uso que deciden por ella', async () => {
      await llamar('patch', `/usuarios/${ID}/deshabilitar`, ADMINISTRATIVO).expect(200);
      expect(accounts.deactivate).toHaveBeenCalledWith(ID, {
        accountId: 'cuenta-test',
        sessionId: 'sesion-test',
        rol: RolUsuario.ADMINISTRATIVO,
        esSuperadmin: false,
      });
    });

    it('GET /usuarios solo pide incluir bajas con incluirBajas=true', async () => {
      await llamar('get', '/usuarios?incluirBajas=true', SUPERADMIN).expect(200);
      await llamar('get', '/usuarios?incluirBajas=1', SUPERADMIN).expect(200);
      await llamar('get', '/usuarios', SUPERADMIN).expect(200);
      expect(accounts.list.mock.calls.map((c) => (c as unknown[])[1])).toEqual([true, false, false]);
    });
  });

  describe('validación de entrada', () => {
    it('rechaza crear personal con una contraseña que no cumple la política', async () => {
      await llamar('post', '/usuarios', ADMINISTRATIVO, { ...STAFF, password: 'ClaveSegura123' }).expect(400);
      expect(auth.register).not.toHaveBeenCalled();
    });

    it('rechaza crear un administrativo con email inválido', async () => {
      await llamar('post', '/usuarios/administrativos', SUPERADMIN, { ...ADMIN, email: 'no-es-email' }).expect(400);
      expect(accounts.createAdministrator).not.toHaveBeenCalled();
    });

    it('rechaza un horario que no está en bloques de 30 minutos', async () => {
      await llamar('patch', `/usuarios/${ID}/horario`, ADMINISTRATIVO, { horaInicio: '08:15', horaFin: '16:00' }).expect(400);
      expect(accounts.updateSchedule).not.toHaveBeenCalled();
    });
  });
});
