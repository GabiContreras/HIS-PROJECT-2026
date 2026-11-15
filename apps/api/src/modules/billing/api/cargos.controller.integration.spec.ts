import { INestApplication } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { Cargo, TipoAtencionFacturable } from '../../../entities/cargo.entity.js';
import { Turno } from '../../../entities/turno.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { AuthGuard } from '../../iam/api/auth.guard.js';
import { RolesGuard } from '../../iam/api/roles.guard.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { InMemoryOutboxStore } from '../../../shared/events/outbox/in-memory-outbox.store.js';
import { OutboxService } from '../../../shared/events/outbox/outbox.service.js';
import { OUTBOX_STORE } from '../../../shared/events/outbox/outbox.types.js';
import {
  APPOINTMENT_ATTENDED_EVENT,
  AppointmentAttendedSubscriber,
} from '../application/appointment-attended.subscriber.js';
import { BillingService } from '../application/billing.service.js';
import { NomencladorService } from '../application/nomenclador.service.js';
import { NOMENCLADOR_REPOSITORY } from '../domain/nomenclador.repository.js';
import { ConsultaRegularStrategy } from '../domain/consulta-regular.strategy.js';
import { ConsultaUrgenciaStrategy } from '../domain/consulta-urgencia.strategy.js';
import { CargosController } from './cargos.controller.js';
import { Insumo } from '../../../entities/insumo.entity.js';
import { AdministracionMedicacion } from '../../../entities/administracion-medicacion.entity.js';

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
    createQueryBuilder: vi.fn(() => {
      const query = {
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        addOrderBy: vi.fn().mockReturnThis(),
        offset: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        getMany: vi.fn(async () => [...charges]),
        getCount: vi.fn(async () => charges.length),
      };
      return query;
    }),
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

  const nomenclador = {
    findPrestacionActiva: vi.fn(async (codigo: string) =>
      codigo === 'CONSULTA_URGENCIA'
        ? { id: 'prestacion-urgencia', codigo, valorBasePesos: 25_000, copagoPesos: 3_000 }
        : { id: 'prestacion-regular', codigo, valorBasePesos: 15_000, copagoPesos: 3_000 },
    ),
    findTarifaActiva: vi.fn(async () => null as { valorPesos: number; copagoPesos: number | null } | null),
  };

  beforeEach(async () => {
    charges.length = 0;
    appointments.length = 0;
    vi.clearAllMocks();
    nomenclador.findTarifaActiva.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      controllers: [CargosController],
      providers: [
        { provide: OUTBOX_STORE, useValue: new InMemoryOutboxStore() },
        OutboxService,
        EventBus,
        BillingService,
        NomencladorService,
        { provide: NOMENCLADOR_REPOSITORY, useValue: nomenclador },
        ConsultaRegularStrategy,
        ConsultaUrgenciaStrategy,
        AppointmentAttendedSubscriber,
        { provide: getRepositoryToken(Cargo), useValue: repository },
        { provide: getRepositoryToken(Turno), useValue: turnosRepository },
        {provide: getRepositoryToken(Insumo),useValue: {findOneByOrFail: vi.fn(),},},
        {provide: getRepositoryToken(AdministracionMedicacion),useValue: {findOne: vi.fn(),}},
        { provide: getRepositoryToken(Paciente), useValue: { findOneBy: vi.fn() } },
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

    expect(response.body.total).toBe(2);
    expect(response.body.items).toEqual([
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

    expect(response.body.items).toEqual([
      // El turno no se pudo leer: el cargo igual se lista.
      expect.objectContaining({ turnoId: 'appointment-gone', turno: null, paciente: null }),
      expect.objectContaining({
        turnoId: 'appointment-regular',
        paciente: expect.objectContaining({ id: 'patient-1', apellido: 'Rojas' }),
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

    expect(response.body.items[0]).toMatchObject({
      importePesos: 15_000,
      cobertura: { tipo, entidad, pacientePesos: paciente, terceroPesos: tercero },
    });
  });

  it('usa la tarifa del financiador del paciente cuando existe', async () => {
    appointments.push({
      id: 'appointment-tarifa',
      fechaHora: new Date('2030-01-01T12:00:00.000Z'),
      duracionMinutos: 30,
      urgente: false,
      medico: { id: 'doctor-1', nombre: 'Ada', apellido: 'Lovelace' },
      paciente: {
        id: 'patient-1',
        nombre: 'Ana',
        apellido: 'Rojas',
        documento: '28456921',
        tipoCobertura: 'MEDICINA_PREPAGA',
        entidadCobertura: 'Medicina Prepaga Premium',
        financiadorId: 'financiador-1',
      },
    } as unknown as Partial<Turno>);
    nomenclador.findTarifaActiva.mockResolvedValue({ valorPesos: 18_000, copagoPesos: 2_000 });
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:00.000Z',
      payload: { appointmentId: 'appointment-tarifa', urgente: false },
    });
    await vi.waitFor(() => expect(charges).toHaveLength(1));

    const response = await request(app.getHttpServer()).get('/billing/cargos').expect(200);

    expect(nomenclador.findTarifaActiva).toHaveBeenCalledWith('financiador-1', 'prestacion-regular');
    expect(response.body.items[0]).toMatchObject({
      importePesos: 18_000,
      cobertura: { pacientePesos: 2_000, terceroPesos: 16_000 },
    });
  });

  it('no crea el cargo si la prestación no existe en el nomenclador', async () => {
    nomenclador.findPrestacionActiva.mockResolvedValue(null as never);
    events.publish({
      type: APPOINTMENT_ATTENDED_EVENT,
      occurredAt: '2030-01-01T00:00:00.000Z',
      payload: { appointmentId: 'appointment-sin-prestacion', urgente: false },
    });
    await vi.waitFor(() => expect(nomenclador.findPrestacionActiva).toHaveBeenCalled());

    expect(charges).toHaveLength(0);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
