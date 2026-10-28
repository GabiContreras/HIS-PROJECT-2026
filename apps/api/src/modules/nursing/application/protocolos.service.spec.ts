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
        tareas: [...data.tareas],
      };
      guardados.set(data.ingresoId, protocolo);
      return { protocolo, creado: true };
    }),
    listarPorPaciente: vi.fn(async (pacienteId: string) =>
      [...guardados.values()].filter((p) => p.pacienteId === pacienteId),
    ),
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
