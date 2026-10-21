import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { Cargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import {
  APPOINTMENT_ATTENDED_EVENT,
  AppointmentAttendedSubscriber,
} from '../application/appointment-attended.subscriber.js';
import { BillingService } from '../application/billing.service.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';
import { CargosController } from './cargos.controller.js';

describe('Billing integration', () => {
  let app: INestApplication;
  let events: EventBus;
  const charges: Cargo[] = [];
  const repository = {
    create: vi.fn((input: Partial<Cargo>) => input),
    save: vi.fn(async (input: Partial<Cargo>) => {
      if (charges.some((charge) => charge.turnoId === input.turnoId)) {
        throw new QueryFailedError('INSERT INTO cargos', [], { code: '23505' });
      }
      const charge = {
        ...input,
        id: `charge-${charges.length + 1}`,
        createdAt: new Date('2030-01-01T00:00:00.000Z'),
      } as Cargo;
      charges.unshift(charge);
      return charge;
    }),
    find: vi.fn(async () => [...charges]),
    findOneByOrFail: vi.fn(async ({ turnoId }: { turnoId: string }) => {
      const charge = charges.find((item) => item.turnoId === turnoId);
      if (!charge) throw new Error('Charge not found');
      return charge;
    }),
  };

  beforeEach(async () => {
    charges.length = 0;
    vi.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [CargosController],
      providers: [
        EventBus,
        BillingService,
        ConsultaRegularStrategy,
        ConsultaUrgenciaStrategy,
        AppointmentAttendedSubscriber,
        { provide: getRepositoryToken(Cargo), useValue: repository },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = module.createNestApplication();
    events = app.get(EventBus);
    await app.init();
  });

  afterEach(async () => {
    await app?.close();
  });

  it('creates one charge per attended appointment and exposes it over HTTP', async () => {
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:00.000Z',
      payload: { appointmentId: 'appointment-regular', urgente: false },
    });
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:01.000Z',
      payload: { appointmentId: 'appointment-urgent', urgente: true },
    });
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:02.000Z',
      payload: { appointmentId: 'appointment-regular', urgente: false },
    });

    await vi.waitFor(() => expect(charges).toHaveLength(2));

    const response = await request(app.getHttpServer())
      .get('/billing/cargos')
      .expect(200);

    expect(response.body).toEqual([
      expect.objectContaining({
        turnoId: 'appointment-urgent',
        importePesos: 25_000,
        tipoAtencion: TipoAtencionFacturable.URGENCIA,
      }),
      expect.objectContaining({
        turnoId: 'appointment-regular',
        importePesos: 15_000,
        tipoAtencion: TipoAtencionFacturable.REGULAR,
      }),
    ]);
    expect(repository.save).toHaveBeenCalledTimes(3);
  });
});
