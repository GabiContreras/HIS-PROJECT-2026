import { ConflictException, NotFoundException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { Internacion } from '../../../entities/internacion.entity.js';
import { Paciente } from '../../../entities/paciente.entity.js';
import { RolUsuario, Usuario } from '../../../entities/usuario.entity.js';
import { BedAssigned } from '../../../shared/events/bed-assigned.event.js';
import type { DomainEvent } from '../../../shared/events/domain-event.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientAdmitted, type PatientAdmittedPayload } from '../../../shared/events/patient-admitted.event.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import type { NuevoProtocolo, ProtocoloData } from '../../nursing/domain/ports/protocolos.repository.js';
import { PatientAdmittedSubscriber } from '../../nursing/application/patient-admitted.subscriber.js';
import { ProtocolosService } from '../../nursing/application/protocolos.service.js';
import { AsignarCamaDto } from '../api/dto/asignar-cama.dto.js';
import { EstadoCama } from '../domain/estado-cama.enum.js';
import { CamasService } from './camas.service.js';

const CAMA = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PACIENTE = '22222222-2222-4222-8222-222222222222';
const MEDICO = '33333333-3333-4333-8333-333333333333';
const INTERNACION = '11111111-1111-4111-8111-111111111111';
const INGRESO_EN = new Date('2030-01-01T10:00:00.000Z');

const admin: SessionIdentity = { accountId: 'admin-1', sessionId: 's1', rol: RolUsuario.ADMINISTRATIVO, esSuperadmin: false };

interface Options {
  estado?: EstadoCama;
  pacienteExiste?: boolean;
  internacionesActivas?: number;
}

/** Arma el servicio con un EntityManager falso: la transacción corre el trabajo y devuelve su resultado. */
function build(options: Options = {}) {
  const cama = { id: CAMA, numero: '101', sector: 'Piso 1', estado: options.estado ?? EstadoCama.LIBRE, pacienteActual: null };
  const internacionesGuardadas: Array<Record<string, unknown>> = [];

  const manager = {
    query: vi.fn(async () => undefined),
    createQueryBuilder: vi.fn(() => {
      const qb = { setLock: () => qb, where: () => qb, getOne: async () => cama };
      return qb;
    }),
    findOne: vi.fn(async (entity: unknown) => {
      if (entity === Usuario) return { id: MEDICO };
      if (entity === Paciente) return options.pacienteExiste === false ? null : { id: PACIENTE, nombre: 'Laura', apellido: 'Gómez' };
      return null;
    }),
    count: vi.fn(async () => options.internacionesActivas ?? 0),
    create: vi.fn((_entity: unknown, data: Record<string, unknown>) => data),
    save: vi.fn(async (entity: unknown, data: Record<string, unknown>) => {
      if (entity === Internacion) {
        const guardada = { ...data, id: INTERNACION, fechaIngreso: INGRESO_EN, fechaEgreso: null };
        internacionesGuardadas.push(guardada);
        return guardada;
      }
      return data;
    }),
  };
  const dataSource = { transaction: vi.fn(async (trabajo: (m: typeof manager) => Promise<unknown>) => trabajo(manager)) };

  const events = new EventBus();
  const published: DomainEvent[] = [];
  events.ofType(BedAssigned.EVENT_TYPE).subscribe((event) => published.push(event));
  events.ofType(PatientAdmitted.EVENT_TYPE).subscribe((event) => published.push(event));

  const service = new CamasService({} as never, dataSource as never, events);
  return { service, events, published, internacionesGuardadas, manager };
}

describe('CamasService.asignar', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('con motivo: guarda el motivo y publica bed.assigned y patient.admitted con el id de la internación', async () => {
    const { service, published, internacionesGuardadas } = build();

    const cama = await service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Cirugía programada' }, admin);

    expect(cama.estado).toBe(EstadoCama.OCUPADA);
    expect(internacionesGuardadas).toHaveLength(1);
    expect(internacionesGuardadas[0].motivoIngreso).toBe('Cirugía programada');
    expect(published.map((e) => e.type)).toEqual([BedAssigned.EVENT_TYPE, PatientAdmitted.EVENT_TYPE]);

    const admitted = published[1] as DomainEvent<PatientAdmittedPayload>;
    expect(admitted.payload).toEqual({
      admissionId: INTERNACION,
      patientId: PACIENTE,
      reason: 'Cirugía programada',
      admittedAt: INGRESO_EN.toISOString(),
    });
    expect(admitted.correlationId).toBe(INTERNACION);
  });

  it('sin motivo: guarda null y solo publica bed.assigned', async () => {
    const { service, published, internacionesGuardadas } = build();

    await service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO }, admin);

    expect(internacionesGuardadas[0].motivoIngreso).toBeNull();
    expect(published.map((e) => e.type)).toEqual([BedAssigned.EVENT_TYPE]);
  });

  it('cama ocupada: 409 y no publica nada', async () => {
    const { service, published, internacionesGuardadas } = build({ estado: EstadoCama.OCUPADA });

    await expect(
      service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Cirugía programada' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(internacionesGuardadas).toHaveLength(0);
    expect(published).toHaveLength(0);
  });

  it('paciente con internación activa: 409 y no publica nada', async () => {
    const { service, published, internacionesGuardadas } = build({ internacionesActivas: 1 });

    await expect(
      service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Neumonía' }, admin),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(internacionesGuardadas).toHaveLength(0);
    expect(published).toHaveLength(0);
  });

  it('paciente inexistente: 404 y no publica nada', async () => {
    const { service, published } = build({ pacienteExiste: false });

    await expect(
      service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Neumonía' }, admin),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(published).toHaveLength(0);
  });
});

describe('CamasService.asignar + suscriptor de Enfermería (EventBus real)', () => {
  /** Enfermería real (servicio + suscriptor) sobre un repositorio en memoria. */
  function conEnfermeria(events: EventBus) {
    const guardados = new Map<string, ProtocoloData>();
    const repository = {
      crearSiNoExiste: vi.fn(async (data: NuevoProtocolo) => {
        const existente = guardados.get(data.ingresoId);
        if (existente) return { protocolo: existente, creado: false };
        const protocolo: ProtocoloData = {
          id: `protocolo-${guardados.size + 1}`,
          ingresoId: data.ingresoId,
          pacienteId: data.pacienteId,
          tipo: data.tipo,
          motivoIngreso: data.motivoIngreso,
          generadoEn: new Date('2030-01-01T10:00:01.000Z'),
          tareas: data.tareas.map((t, i) => ({ ...t, id: `tarea-${i + 1}`, hecha: false, hechaEn: null, hechaPor: null })),
        };
        guardados.set(data.ingresoId, protocolo);
        return { protocolo, creado: true };
      }),
      listarPorPaciente: vi.fn(async (pacienteId: string) => [...guardados.values()].filter((p) => p.pacienteId === pacienteId)),
      marcarTarea: vi.fn(),
    };
    const pacientes = { get: vi.fn(async () => ({ id: PACIENTE })) };
    const protocolos = new ProtocolosService(repository as never, pacientes as never);
    const subscriber = new PatientAdmittedSubscriber(events, protocolos);
    subscriber.onModuleInit();
    return { protocolos, subscriber, guardados };
  }

  /** El suscriptor procesa en segundo plano: se espera a que termine la cola de promesas. */
  const esperarSuscriptor = () => new Promise((resolve) => setImmediate(resolve));

  it('asignar con "Cirugía programada" deja el protocolo pre-quirúrgico de ese ingreso', async () => {
    const { service, events } = build();
    const { protocolos, subscriber } = conEnfermeria(events);

    await service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Cirugía programada' }, admin);
    await esperarSuscriptor();

    const lista = await protocolos.listarPorPaciente(PACIENTE);
    expect(lista).toHaveLength(1);
    expect(lista[0].ingresoId).toBe(INTERNACION);
    expect(lista[0].tipo).toBe('PRE_QUIRURGICO');
    expect(lista[0].tareas.map((t) => t.descripcion)).toEqual([
      'Verificar ayuno de 8 horas',
      'Colocar vía intravenosa periférica',
      'Realizar control de signos vitales cada 2 horas',
    ]);
    subscriber.onModuleDestroy();
  });

  it('asignar con "Neumonía" deja el protocolo respiratorio', async () => {
    const { service, events } = build();
    const { protocolos, subscriber } = conEnfermeria(events);

    await service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Neumonía' }, admin);
    await esperarSuscriptor();

    const lista = await protocolos.listarPorPaciente(PACIENTE);
    expect(lista).toHaveLength(1);
    expect(lista[0].tipo).toBe('RESPIRATORIO');
    subscriber.onModuleDestroy();
  });

  it('un motivo sin protocolo definido no rompe la asignación ni genera protocolo', async () => {
    const { service, events } = build();
    const { protocolos, subscriber } = conEnfermeria(events);

    const cama = await service.asignar(CAMA, { pacienteId: PACIENTE, medicoId: MEDICO, motivoIngreso: 'Traumatismo' }, admin);
    await esperarSuscriptor();

    expect(cama.estado).toBe(EstadoCama.OCUPADA);
    expect(await protocolos.listarPorPaciente(PACIENTE)).toHaveLength(0);
    subscriber.onModuleDestroy();
  });
});

describe('AsignarCamaDto.motivoIngreso', () => {
  const base = { pacienteId: PACIENTE };
  const validar = async (motivoIngreso: unknown) => {
    const dto = plainToInstance(AsignarCamaDto, { ...base, motivoIngreso });
    return { dto, errores: await validate(dto) };
  };

  it('es opcional', async () => {
    const { errores } = await validar(undefined);
    expect(errores).toHaveLength(0);
  });

  it('recorta espacios', async () => {
    const { dto, errores } = await validar('  Cirugía programada  ');
    expect(errores).toHaveLength(0);
    expect(dto.motivoIngreso).toBe('Cirugía programada');
  });

  it('trata el texto vacío o de solo espacios como no informado', async () => {
    for (const valor of ['', '    ']) {
      const { dto, errores } = await validar(valor);
      expect(errores).toHaveLength(0);
      expect(dto.motivoIngreso).toBeUndefined();
    }
  });

  it('rechaza menos de 3 caracteres, más de 200 y valores que no son texto', async () => {
    for (const valor of ['ab', 'x'.repeat(201), 123]) {
      const { errores } = await validar(valor);
      expect(errores.map((e) => e.property)).toEqual(['motivoIngreso']);
    }
  });
});
