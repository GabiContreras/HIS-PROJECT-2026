import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { Cargo, TipoAtencionFacturable } from '../infrastructure/persistence/entities/cargo.entity.js';
import { Turno } from '../../admissions/infrastructure/persistence/entities/turno.entity.js';
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
import { Insumo } from '../../resources/infrastructure/persistence/entities/insumo.entity.js';
import { AdministracionMedicacion } from '../../nursing/infrastructure/persistence/entities/administracion-medicacion.entity.js';

describe('Billing integration', () => {
  let app: INestApplication;
  let events: EventBus;
  const charges: Cargo[] = [];
  const repository = {
    create: vi.fn((input: Partial<Cargo>) => input),
    save: vi.fn(async (input: Partial<Cargo>) => {
      if (charges.some((charge) => charge.turnoId === input.turnoId)) {
        throw new QueryFailedError(
          'INSERT INTO cargos',
          [],
          Object.assign(new Error('duplicate key'), { code: '23505' }),
        );
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

  // Turnos que originaron los cargos (paciente y médico se leen de acá).
  const appointments: Array<Partial<Turno>> = [];
  const turnosRepository = {
    find: vi.fn(async () => [...appointments]),
    findOne: vi.fn(
      async ({ where }: { where: { id: string } }) =>
        appointments.find((turno) => turno.id === where.id) ?? null,
    ),
  };

  beforeEach(async () => {
    charges.length = 0;
    appointments.length = 0;
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
        { provide: getRepositoryToken(Turno), useValue: turnosRepository },
        {provide: getRepositoryToken(Insumo),useValue: {findOneByOrFail: vi.fn(),},},
        {provide: getRepositoryToken(AdministracionMedicacion),useValue: {findOne: vi.fn(),}},
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

  it('incluye paciente, médico y fecha del turno en cada cargo', async () => {
    appointments.push({
      id: 'appointment-regular',
      fechaHora: new Date('2030-01-01T12:00:00.000Z'),
      duracionMinutos: 30,
      urgente: false,
      medico: { id: 'doctor-1', nombre: 'Ada', apellido: 'Lovelace' },
      paciente: {
        id: 'patient-1',
        nombre: 'Ana',
        apellido: 'Rojas',
        documento: '28456921',
        tipoCobertura: 'PARTICULAR',
        entidadCobertura: null,
      },
    } as unknown as Partial<Turno>);
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:00.000Z',
      payload: { appointmentId: 'appointment-regular', urgente: false },
    });
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:01.000Z',
      payload: { appointmentId: 'appointment-gone', urgente: false },
    });
    await vi.waitFor(() => expect(charges).toHaveLength(2));

    const response = await request(app.getHttpServer())
      .get('/billing/cargos')
      .expect(200);

    expect(response.body).toEqual([
      // El turno no se pudo leer: el cargo igual se lista.
      expect.objectContaining({ turnoId: 'appointment-gone', turno: null }),
      expect.objectContaining({
        turnoId: 'appointment-regular',
        turno: expect.objectContaining({
          duracionMinutos: 30,
          medico: expect.objectContaining({ apellido: 'Lovelace' }),
          paciente: expect.objectContaining({ apellido: 'Rojas', documento: '28456921' }),
        }),
      }),
    ]);
  });

  it.each([
    ['OBRA_SOCIAL_PUBLICA', null, 0, 15_000],
    ['MEDICINA_PREPAGA', 'Medicina Prepaga Premium', 3_000, 12_000],
    ['PARTICULAR', null, 15_000, 0],
  ])('factura según la cobertura %s del paciente', async (tipo, entidad, paciente, tercero) => {
    appointments.push({
      id: 'appointment-covered',
      fechaHora: new Date('2030-01-01T12:00:00.000Z'),
      duracionMinutos: 30,
      urgente: false,
      medico: { id: 'doctor-1', nombre: 'Ada', apellido: 'Lovelace' },
      paciente: {
        id: 'patient-1',
        nombre: 'Ana',
        apellido: 'Rojas',
        documento: '28456921',
        tipoCobertura: tipo,
        entidadCobertura: entidad,
      },
    } as unknown as Partial<Turno>);
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:00.000Z',
      payload: { appointmentId: 'appointment-covered', urgente: false },
    });
    await vi.waitFor(() => expect(charges).toHaveLength(1));

    const response = await request(app.getHttpServer()).get('/billing/cargos').expect(200);

    expect(response.body[0]).toMatchObject({
      importePesos: 15_000,
      cobertura: { tipo, entidad, pacientePesos: paciente, terceroPesos: tercero },
    });
  });
});
