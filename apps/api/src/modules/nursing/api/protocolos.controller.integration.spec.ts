import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { ProtocolosService } from '../application/protocolos.service.js';
import { ProtocolosController } from './protocolos.controller.js';

const PACIENTE_ID = '550e8400-e29b-41d4-a716-446655440000';
const INGRESO_ID = '550e8400-e29b-41d4-a716-446655440001';
const PROTOCOLO_ID = '550e8400-e29b-41d4-a716-446655440002';
const TAREA_ID = '550e8400-e29b-41d4-a716-446655440003';
const ROL_HEADER = 'x-test-rol';

const INGRESO = { ingresoId: INGRESO_ID, pacienteId: PACIENTE_ID, motivoIngreso: 'Cirugía programada' };
const RUTA_TAREA = `/protocolos/${PROTOCOLO_ID}/tareas/${TAREA_ID}`;

describe('ProtocolosController: autorización por rol y validación de entrada', () => {
  let app: INestApplication;

  // El caso de uso se simula: acá se prueba la capa HTTP (guards, pipes y delegación), no la base de datos.
  const protocolo = { id: PROTOCOLO_ID, tareas: [] };
  const service = {
    listarPorPaciente: vi.fn(async () => [protocolo]),
    marcarTarea: vi.fn(async () => protocolo),
    generarParaIngreso: vi.fn(async () => ({ protocolo })),
  };

  // Reemplaza solo la autenticación: sin header no hay sesión (401); con header el usuario tiene ese rol.
  // El RolesGuard es el real, por eso los 403 que se verifican son los del controlador.
  const authGuardFalso = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
      const rol = req.headers[ROL_HEADER];
      if (!rol) throw new UnauthorizedException('Sin sesión.');
      req.user = { accountId: 'cuenta-test', sessionId: 'sesion-test', rol, esSuperadmin: false };
      return true;
    },
  };

  // Checklist del protocolo: lo trabaja enfermería y el médico lo consulta/corrige.
  // Alta del ingreso (POST ingresos): la regla está pendiente de decisión (¿solo ADMINISTRATIVO o también MEDICO?).
  // Por eso ahí solo se afirma lo que vale en ambas opciones: ADMINISTRATIVO entra y ENFERMERO queda afuera.
  // MEDICO no se afirma en ningún sentido hasta que el equipo decida.
  const endpoints = [
    {
      nombre: 'GET /protocolos',
      metodo: 'get',
      ruta: `/protocolos?pacienteId=${PACIENTE_ID}`,
      ok: 200,
      caso: 'listarPorPaciente',
      permitidos: [RolUsuario.ENFERMERO, RolUsuario.MEDICO],
      rechazados: [RolUsuario.ADMINISTRATIVO],
    },
    {
      nombre: 'PATCH /protocolos/:protocoloId/tareas/:tareaId',
      metodo: 'patch',
      ruta: RUTA_TAREA,
      body: { hecha: true },
      ok: 200,
      caso: 'marcarTarea',
      permitidos: [RolUsuario.ENFERMERO, RolUsuario.MEDICO],
      rechazados: [RolUsuario.ADMINISTRATIVO],
    },
    {
      nombre: 'POST /protocolos/ingresos',
      metodo: 'post',
      ruta: '/protocolos/ingresos',
      body: INGRESO,
      ok: 201,
      caso: 'generarParaIngreso',
      permitidos: [RolUsuario.ADMINISTRATIVO],
      rechazados: [RolUsuario.ENFERMERO],
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
      controllers: [ProtocolosController],
      providers: [{ provide: ProtocolosService, useValue: service }],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuardFalso)
      .compile();
    app = module.createNestApplication();
    // Misma configuración que app.module.ts.
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  describe.each(endpoints)('$nombre', (endpoint) => {
    const body = 'body' in endpoint ? endpoint.body : undefined;
    const permitidos = endpoint.permitidos as readonly RolUsuario[];
    const rechazados = endpoint.rechazados as readonly RolUsuario[];

    it.each(permitidos)('permite a %s y ejecuta el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(endpoint.ok);
      expect(service[endpoint.caso]).toHaveBeenCalledTimes(1);
    });

    it.each(rechazados)('rechaza a %s con 403 sin ejecutar el caso de uso', async (rol) => {
      await llamar(endpoint.metodo, endpoint.ruta, rol, body).expect(403);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });

    it('rechaza sin sesión con 401 sin ejecutar el caso de uso', async () => {
      await llamar(endpoint.metodo, endpoint.ruta, undefined, body).expect(401);
      expect(service[endpoint.caso]).not.toHaveBeenCalled();
    });
  });

  describe('validación de entrada', () => {
    it('rechaza consultar protocolos sin pacienteId', async () => {
      await llamar('get', '/protocolos', RolUsuario.ENFERMERO).expect(400);
      expect(service.listarPorPaciente).not.toHaveBeenCalled();
    });

    it('rechaza consultar protocolos con un pacienteId que no es UUID', async () => {
      await llamar('get', '/protocolos?pacienteId=abc', RolUsuario.ENFERMERO).expect(400);
      expect(service.listarPorPaciente).not.toHaveBeenCalled();
    });

    it.each([
      ['protocoloId que no es UUID', `/protocolos/no-es-uuid/tareas/${TAREA_ID}`],
      ['tareaId que no es UUID', `/protocolos/${PROTOCOLO_ID}/tareas/no-es-uuid`],
    ])('rechaza marcar una tarea con %s', async (_motivo, ruta) => {
      await llamar('patch', ruta, RolUsuario.ENFERMERO, { hecha: true }).expect(400);
      expect(service.marcarTarea).not.toHaveBeenCalled();
    });

    it.each([
      ['sin el campo hecha', {}],
      ['con hecha que no es booleano', { hecha: 'si' }],
    ])('rechaza marcar una tarea %s', async (_motivo, cuerpo) => {
      await llamar('patch', RUTA_TAREA, RolUsuario.ENFERMERO, cuerpo).expect(400);
      expect(service.marcarTarea).not.toHaveBeenCalled();
    });

    it.each([
      ['ingresoId que no es UUID', { ingresoId: 'ingreso-1' }],
      ['pacienteId que no es UUID', { pacienteId: 'paciente-1' }],
      ['motivo de menos de 3 caracteres', { motivoIngreso: 'ab' }],
      ['motivo de más de 200 caracteres', { motivoIngreso: 'x'.repeat(201) }],
    ])('rechaza un ingreso con %s', async (_motivo, cambio) => {
      await llamar('post', '/protocolos/ingresos', RolUsuario.ADMINISTRATIVO, { ...INGRESO, ...cambio }).expect(400);
      expect(service.generarParaIngreso).not.toHaveBeenCalled();
    });

    it('rechaza un ingreso al que le falta el motivo', async () => {
      const { motivoIngreso: _motivo, ...incompleto } = INGRESO;
      await llamar('post', '/protocolos/ingresos', RolUsuario.ADMINISTRATIVO, incompleto).expect(400);
      expect(service.generarParaIngreso).not.toHaveBeenCalled();
    });
  });

  describe('delegación al caso de uso', () => {
    it('pasa el pacienteId del filtro a la consulta', async () => {
      await llamar('get', `/protocolos?pacienteId=${PACIENTE_ID}`, RolUsuario.MEDICO).expect(200);
      expect(service.listarPorPaciente).toHaveBeenCalledWith(PACIENTE_ID);
    });

    it.each([true, false])('marca la tarea con hecha=%s a nombre del usuario de la sesión', async (hecha) => {
      await llamar('patch', RUTA_TAREA, RolUsuario.ENFERMERO, { hecha }).expect(200);
      expect(service.marcarTarea).toHaveBeenCalledWith(
        PROTOCOLO_ID,
        TAREA_ID,
        hecha,
        expect.objectContaining({ accountId: 'cuenta-test', rol: RolUsuario.ENFERMERO }),
      );
    });

    it('devuelve el protocolo generado, sin el envoltorio del caso de uso', async () => {
      const res = await llamar('post', '/protocolos/ingresos', RolUsuario.ADMINISTRATIVO, INGRESO).expect(201);
      expect(service.generarParaIngreso).toHaveBeenCalledWith(expect.objectContaining(INGRESO));
      expect(res.body).toEqual(protocolo);
    });
  });
});
