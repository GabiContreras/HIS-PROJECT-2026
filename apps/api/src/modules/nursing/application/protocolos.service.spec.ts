import { BadRequestException, NotFoundException } from '@nestjs/common';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { PatientAdmitted } from '../../../shared/events/patient-admitted.event.js';
import type { NuevoProtocolo, ProtocoloData } from '../domain/ports/protocolos.repository.js';
import { PatientAdmittedSubscriber } from './patient-admitted.subscriber.js';
import { ProtocolosService } from './protocolos.service.js';

const INGRESO = '11111111-1111-4111-8111-111111111111';
const PACIENTE = '22222222-2222-4222-8222-222222222222';

function build(options: { patientExists?: boolean } = {}) {
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
        generadoEn: new Date('2030-01-01T10:00:00.000Z'),
        tareas: data.tareas.map((t, i) => ({
          ...t,
          id: `tarea-${guardados.size + 1}-${i + 1}`,
          hecha: false,
          hechaEn: null,
          hechaPor: null,
        })),
      };
      guardados.set(data.ingresoId, protocolo);
      return { protocolo, creado: true };
    }),
    listarPorPaciente: vi.fn(async (pacienteId: string) =>
      [...guardados.values()].filter((p) => p.pacienteId === pacienteId),
    ),
    marcarTarea: vi.fn(async (protocoloId: string, tareaId: string, hecha: boolean, usuarioId: string) => {
      const protocolo = [...guardados.values()].find((p) => p.id === protocoloId);
      const tarea = protocolo?.tareas.find((t) => t.id === tareaId);
      if (!protocolo || !tarea) return null;
      tarea.hecha = hecha;
      tarea.hechaEn = hecha ? new Date('2030-01-01T11:00:00.000Z') : null;
      tarea.hechaPor = hecha ? `Apellido ${usuarioId}, Nombre` : null;
      return protocolo;
    }),
  };
  const pacientes = {
    get: vi.fn(async () => {
      if (options.patientExists === false) throw new NotFoundException();
      return { id: PACIENTE };
    }),
  };
  const service = new ProtocolosService(repository as never, pacientes as never);
  return { service, repository, pacientes, guardados };
}

describe('ProtocolosService', () => {
  it('genera el protocolo pre-quirúrgico con las tareas de la HU', async () => {
    const { service } = build();
    const { protocolo, creado } = await service.generarParaIngreso({
      ingresoId: INGRESO,
      pacienteId: PACIENTE,
      motivoIngreso: 'Cirugía programada',
    });
    expect(creado).toBe(true);
    expect(protocolo.tipo).toBe('PRE_QUIRURGICO');
    expect(protocolo.generadoEn).toBe('2030-01-01T10:00:00.000Z');
    expect(protocolo.tareas.map((t) => t.descripcion)).toEqual([
      'Verificar ayuno de 8 horas',
      'Colocar vía intravenosa periférica',
      'Realizar control de signos vitales cada 2 horas',
    ]);
  });

  it('genera el protocolo respiratorio para neumonía', async () => {
    const { service } = build();
    const { protocolo } = await service.generarParaIngreso({
      ingresoId: INGRESO,
      pacienteId: PACIENTE,
      motivoIngreso: 'Neumonía',
    });
    expect(protocolo.tipo).toBe('RESPIRATORIO');
    expect(protocolo.tareas.map((t) => t.descripcion)).toEqual([
      'Monitoreo de saturación de oxígeno continuo',
      'Indicación de aislamiento de contacto y gotas',
    ]);
  });

  it('es idempotente: reprocesar el mismo ingreso no duplica el protocolo', async () => {
    const { service, guardados } = build();
    const input = { ingresoId: INGRESO, pacienteId: PACIENTE, motivoIngreso: 'Neumonía' };
    const primero = await service.generarParaIngreso(input);
    const segundo = await service.generarParaIngreso(input);
    expect(primero.creado).toBe(true);
    expect(segundo.creado).toBe(false);
    expect(segundo.protocolo.id).toBe(primero.protocolo.id);
    expect(guardados.size).toBe(1);
  });

  it('rechaza con 400 un motivo sin protocolo y no persiste nada', async () => {
    const { service, repository } = build();
    await expect(
      service.generarParaIngreso({ ingresoId: INGRESO, pacienteId: PACIENTE, motivoIngreso: 'Fractura' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.crearSiNoExiste).not.toHaveBeenCalled();
  });

  it('propaga 404 si el paciente no existe', async () => {
    const { service, repository } = build({ patientExists: false });
    await expect(
      service.generarParaIngreso({ ingresoId: INGRESO, pacienteId: PACIENTE, motivoIngreso: 'Neumonía' }),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.crearSiNoExiste).not.toHaveBeenCalled();
  });

  it('lista los protocolos del paciente y da 404 si no existe', async () => {
    const { service } = build();
    await service.generarParaIngreso({ ingresoId: INGRESO, pacienteId: PACIENTE, motivoIngreso: 'Neumonía' });
    const lista = await service.listarPorPaciente(PACIENTE);
    expect(lista).toHaveLength(1);
    expect(lista[0]?.tareas).toHaveLength(2);

    const sinPaciente = build({ patientExists: false });
    await expect(sinPaciente.service.listarPorPaciente(PACIENTE)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ProtocolosService - checklist permanente', () => {
  const identity = { accountId: 'usuario-1', sessionId: 's', rol: 'ENFERMERO', esSuperadmin: false } as never;

  async function conProtocolo() {
    const ctx = build();
    const { protocolo } = await ctx.service.generarParaIngreso({
      ingresoId: INGRESO,
      pacienteId: PACIENTE,
      motivoIngreso: 'Neumonía',
    });
    return { ...ctx, protocolo, tarea: protocolo.tareas[0]! };
  }

  it('las tareas nuevas vienen con id y sin marcar', async () => {
    const { protocolo } = await conProtocolo();
    expect(protocolo.tareas.every((t) => t.id && t.hecha === false && t.hechaEn === null && t.hechaPor === null)).toBe(true);
  });

  it('marca una tarea y devuelve quién y cuándo', async () => {
    const { service, protocolo, tarea } = await conProtocolo();
    const view = await service.marcarTarea(protocolo.id, tarea.id, true, identity);
    const marcada = view.tareas.find((t) => t.id === tarea.id)!;
    expect(marcada.hecha).toBe(true);
    expect(marcada.hechaEn).toBe('2030-01-01T11:00:00.000Z');
    expect(marcada.hechaPor).toContain('usuario-1');
    expect(view.tareas.filter((t) => t.hecha)).toHaveLength(1);
  });

  it('guarda la identidad de la sesión', async () => {
    const { service, repository, protocolo, tarea } = await conProtocolo();
    await service.marcarTarea(protocolo.id, tarea.id, true, identity);
    expect(repository.marcarTarea).toHaveBeenCalledWith(protocolo.id, tarea.id, true, 'usuario-1');
  });

  it('desmarca y limpia fecha y usuario', async () => {
    const { service, protocolo, tarea } = await conProtocolo();
    await service.marcarTarea(protocolo.id, tarea.id, true, identity);
    const view = await service.marcarTarea(protocolo.id, tarea.id, false, identity);
    const t = view.tareas.find((x) => x.id === tarea.id)!;
    expect(t).toMatchObject({ hecha: false, hechaEn: null, hechaPor: null });
  });

  it('es idempotente: marcar dos veces no falla', async () => {
    const { service, protocolo, tarea } = await conProtocolo();
    await service.marcarTarea(protocolo.id, tarea.id, true, identity);
    const view = await service.marcarTarea(protocolo.id, tarea.id, true, identity);
    expect(view.tareas.find((t) => t.id === tarea.id)?.hecha).toBe(true);
  });

  it('da 404 si la tarea no pertenece a ese protocolo', async () => {
    const { service, protocolo } = await conProtocolo();
    const otro = await service.generarParaIngreso({
      ingresoId: '33333333-3333-4333-8333-333333333333',
      pacienteId: PACIENTE,
      motivoIngreso: 'Cirugía programada',
    });
    const tareaAjena = otro.protocolo.tareas[0]!;
    await expect(service.marcarTarea(protocolo.id, tareaAjena.id, true, identity)).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.marcarTarea(protocolo.id, 'inexistente', true, identity)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('PatientAdmittedSubscriber', () => {
  function evento(reason: string) {
    return new PatientAdmitted({
      admissionId: INGRESO,
      patientId: PACIENTE,
      reason,
      admittedAt: '2030-01-01T09:00:00.000Z',
    });
  }

  it('genera el protocolo al recibir el evento de ingreso (vía EventBus)', async () => {
    const { service, repository } = build();
    const bus = new EventBus();
    const subscriber = new PatientAdmittedSubscriber(bus, service);
    subscriber.onModuleInit();
    bus.publish(evento('Cirugía programada'));
    await vi.waitFor(() => expect(repository.crearSiNoExiste).toHaveBeenCalledTimes(1));
    subscriber.onModuleDestroy();
  });

  it('no propaga errores (motivo sin protocolo) y los registra', async () => {
    const { service, repository } = build();
    const subscriber = new PatientAdmittedSubscriber(new EventBus(), service);
    const error = vi.spyOn(subscriber['logger'], 'error').mockImplementation(() => undefined);
    await expect(subscriber.handle(evento('Fractura'))).resolves.toBeUndefined();
    expect(error).toHaveBeenCalledOnce();
    expect(repository.crearSiNoExiste).not.toHaveBeenCalled();
  });

  it('reprocesar el mismo evento no duplica el protocolo', async () => {
    const { service, guardados } = build();
    const subscriber = new PatientAdmittedSubscriber(new EventBus(), service);
    vi.spyOn(subscriber['logger'], 'log').mockImplementation(() => undefined);
    await subscriber.handle(evento('Neumonía'));
    await subscriber.handle(evento('Neumonía'));
    expect(guardados.size).toBe(1);
  });
});
