import { ExecutionContext, INestApplication, UnauthorizedException, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import request from 'supertest';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { BedCleaned } from '../../../shared/events/bed-cleaned.event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { BedEventsStreamService } from '../application/bed-events-stream.service.js';
import { CamasService } from '../application/camas.service.js';
import { CamasController } from './camas.controller.js';

const ROL_HEADER = 'x-test-rol';
const CAMA_ID = '550e8400-e29b-41d4-a716-446655440000';

describe('CamasController: stream de eventos (GET /camas/eventos)', () => {
  let app: INestApplication;
  let events: EventBus;

  const camas = { obtener: vi.fn(async () => ({ id: CAMA_ID })) };

  // Reemplaza solo la autenticación: sin header no hay sesión (401); con header el usuario tiene ese rol.
  // El RolesGuard es el real.
  const authGuardFalso = {
    canActivate: (context: ExecutionContext) => {
      const req = context.switchToHttp().getRequest<{ headers: Record<string, string | undefined>; user?: unknown }>();
      const rol = req.headers[ROL_HEADER];
      if (!rol) throw new UnauthorizedException('Sin sesión.');
      req.user = { accountId: 'cuenta-test', sessionId: 'sesion-test', rol, esSuperadmin: false };
      return true;
    },
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    events = new EventBus();
    const module = await Test.createTestingModule({
      controllers: [CamasController],
      providers: [
        { provide: CamasService, useValue: camas },
        { provide: EventBus, useValue: events },
        BedEventsStreamService,
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue(authGuardFalso)
      .compile();
    app = module.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
    await app.listen(0);
  });

  afterEach(async () => {
    await app?.close();
  });

  /** Abre el stream, espera el primer mensaje de datos y corta la conexión. */
  function leerPrimerMensaje(rol: RolUsuario, alConectar: () => void): Promise<{ status: number; contentType: string; body: string }> {
    const { port } = app.getHttpServer().address() as AddressInfo;
    return new Promise((resolve, reject) => {
      const req = http.get({ port, path: '/camas/eventos', headers: { [ROL_HEADER]: rol } }, (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => {
          body += chunk;
          if (body.includes('data:')) {
            req.destroy();
            resolve({ status: res.statusCode ?? 0, contentType: String(res.headers['content-type']), body });
          }
        });
        // El stream ya está abierto: se dispara el evento a observar.
        setTimeout(alConectar, 50);
      });
      req.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code !== 'ECONNRESET') reject(error);
      });
    });
  }

  it.each([RolUsuario.MEDICO, RolUsuario.ENFERMERO, RolUsuario.ADMINISTRATIVO])(
    'abre el stream para %s y entrega en vivo el cambio de una cama',
    async (rol) => {
      const { status, contentType, body } = await leerPrimerMensaje(rol, () =>
        events.publish(new BedCleaned({ bedId: CAMA_ID, bedNumber: '205', cleanedAt: '2030-01-01T10:00:00.000Z' })),
      );

      expect(status).toBe(200);
      expect(contentType).toContain('text/event-stream');
      const linea = body.split('\n').find((l) => l.startsWith('data:')) ?? '';
      expect(JSON.parse(linea.slice('data:'.length))).toEqual({
        tipo: 'bed.cleaned',
        camaId: CAMA_ID,
        numero: '205',
        estado: 'LIBRE',
        at: '2030-01-01T10:00:00.000Z',
      });
    },
  );

  it('rechaza sin sesión con 401', async () => {
    await request(app.getHttpServer()).get('/camas/eventos').expect(401);
  });

  it('"eventos" no se interpreta como el id de una cama', async () => {
    // Si GET /camas/:id capturara la ruta, respondería 400 por UUID inválido y llamaría al detalle.
    await leerPrimerMensaje(RolUsuario.ADMINISTRATIVO, () =>
      events.publish(new BedCleaned({ bedId: CAMA_ID, bedNumber: '205', cleanedAt: '2030-01-01T10:00:00.000Z' })),
    );
    expect(camas.obtener).not.toHaveBeenCalled();
  });

  it('GET /camas/:id sigue funcionando con un UUID', async () => {
    await request(app.getHttpServer()).get(`/camas/${CAMA_ID}`).set(ROL_HEADER, RolUsuario.ENFERMERO).expect(200);
    expect(camas.obtener).toHaveBeenCalledWith(CAMA_ID);
  });
});
