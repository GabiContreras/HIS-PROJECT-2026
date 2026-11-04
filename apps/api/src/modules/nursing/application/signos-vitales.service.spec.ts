import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RolUsuario } from '../../../entities/usuario.entity.js';
import { EventBus } from '../../../shared/events/event-bus.service.js';
import { INTEGRATION_EVENTS } from '../../../shared/events/integration-event-names.js';
import type { SessionIdentity } from '../../iam/application/auth.service.js';
import { TipoSignoVital } from '../domain/vital-sign-rules.js';
import type { NuevoSignoVital } from '../domain/ports/signos-vitales.repository.js';
import { SignosVitalesService } from './signos-vitales.service.js';

describe('SignosVitalesService', () => {
  const identity: SessionIdentity = {
    accountId: 'nurse-1',
    sessionId: 'session-1',
    rol: RolUsuario.ENFERMERO,
    esSuperadmin: false,
  };

  function build(options: { patientExists?: boolean } = {}) {
    const repository = {
      create: vi.fn(async (data: NuevoSignoVital) => ({
        id: 'vital-1',
        pacienteId: data.pacienteId,
        paciente: 'López, Carlos',
        tipo: data.tipo,
        valor: data.valor,
        fechaHora: new Date('2030-01-01T10:00:00.000Z'),
        registradoPor: 'Torres, Martín',
        controlId: null,
      })),
      list: vi.fn(),
      createControl: vi.fn(),
      listControles: vi.fn(),
    };
    const pacientes = {
      get: vi.fn(async () => {
        if (options.patientExists === false) throw new NotFoundException();
        return { id: 'patient-1' };
      }),
    };
    const events = new EventBus();
    const published: unknown[] = [];
    events.ofType(INTEGRATION_EVENTS.VITAL_SIGN_ALERT).subscribe((event) => published.push(event));
    const service = new SignosVitalesService(repository as never, pacientes as never, events);
    return { service, repository, published };
  }

  it('stores a stable reading without raising an alert', async () => {
    const { service, repository, published } = build();

    const result = await service.registrar(
      { pacienteId: 'patient-1', tipo: TipoSignoVital.TEMPERATURA, valor: 36.8 },
      identity,
    );

    expect(repository.create).toHaveBeenCalledWith({
      pacienteId: 'patient-1',
      registradoPorId: 'nurse-1',
      tipo: 'TEMPERATURA',
      valor: 36.8,
    });
    expect(result).toMatchObject({ valor: 36.8, unidad: '°C', fueraDeRango: false, paciente: 'López, Carlos' });
    expect(published).toHaveLength(0);
  });

  it('flags a temperature above 39 °C and publishes a high-priority alert event', async () => {
    const { service, published } = build();

    const result = await service.registrar(
      { pacienteId: 'patient-1', tipo: TipoSignoVital.TEMPERATURA, valor: 39.5 },
      identity,
    );

    expect(result.fueraDeRango).toBe(true);
    expect(published).toHaveLength(1);
    expect(published[0]).toMatchObject({
      type: INTEGRATION_EVENTS.VITAL_SIGN_ALERT,
      payload: { patientId: 'patient-1', tipo: 'TEMPERATURA', valor: 39.5, registeredBy: 'nurse-1' },
    });
  });

  it('does not treat exactly 39 °C as out of range', async () => {
    const { service } = build();
    const result = await service.registrar(
      { pacienteId: 'patient-1', tipo: TipoSignoVital.TEMPERATURA, valor: 39 },
      identity,
    );
    expect(result.fueraDeRango).toBe(false);
  });

  it('rejects implausible values with 400 before touching the database', async () => {
    const { service, repository } = build();
    await expect(
      service.registrar({ pacienteId: 'patient-1', tipo: TipoSignoVital.SATURACION_O2, valor: 140 }, identity),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('propagates 404 when the patient does not exist', async () => {
    const { service, repository } = build({ patientExists: false });
    await expect(
      service.registrar({ pacienteId: 'missing', tipo: TipoSignoVital.FRECUENCIA_CARDIACA, valor: 80 }, identity),
    ).rejects.toBeInstanceOf(NotFoundException);
    expect(repository.create).not.toHaveBeenCalled();
  });

  it('lists readings flagging the out-of-range ones', async () => {
    const { service, repository } = build();
    repository.list.mockResolvedValue([
      {
        id: 'v1',
        pacienteId: 'patient-1',
        paciente: 'López, Carlos',
        tipo: 'FRECUENCIA_CARDIACA',
        valor: 130,
        fechaHora: new Date('2030-01-01T10:00:00.000Z'),
        registradoPor: 'Torres, Martín',
        controlId: null,
      },
    ]);

    const [row] = await service.listar();

    expect(repository.list).toHaveBeenCalledWith(undefined, 100);
    expect(row).toMatchObject({ valor: 130, unidad: 'lpm', fueraDeRango: true });
  });

  describe('control de signos vitales (HU 1.1)', () => {
    const fecha = new Date('2030-01-01T10:00:00.000Z');
    const fila = (tipo: string, valor: number, controlId: string | null = 'control-1', id = `v-${tipo}-${controlId}`) => ({
      id,
      pacienteId: 'patient-1',
      paciente: 'López, Carlos',
      tipo,
      valor,
      fechaHora: fecha,
      registradoPor: 'Torres, Martín',
      controlId,
    });
    const filasControl = (temperatura: number, controlId = 'control-1') => [
      fila('PRESION_ARTERIAL', 120, controlId),
      fila('PRESION_DIASTOLICA', 80, controlId),
      fila('FRECUENCIA_CARDIACA', 76, controlId),
      fila('TEMPERATURA', temperatura, controlId),
    ];
    const dto = (temperatura: number) => ({
      pacienteId: 'patient-1',
      sistolica: 120,
      diastolica: 80,
      frecuenciaCardiaca: 76,
      temperatura,
    });

    it('stores a stable control in a single call with the automatic nursing note', async () => {
      const { service, repository, published } = build();
      repository.createControl.mockResolvedValue(filasControl(36.8));

      const result = await service.registrarControl(dto(36.8), identity);

      expect(repository.createControl).toHaveBeenCalledTimes(1);
      expect(repository.createControl).toHaveBeenCalledWith({
        pacienteId: 'patient-1',
        registradoPorId: 'nurse-1',
        lecturas: [
          { tipo: 'PRESION_ARTERIAL', valor: 120 },
          { tipo: 'PRESION_DIASTOLICA', valor: 80 },
          { tipo: 'FRECUENCIA_CARDIACA', valor: 76 },
          { tipo: 'TEMPERATURA', valor: 36.8 },
        ],
      });
      expect(result).toMatchObject({
        id: 'control-1',
        sistolica: 120,
        diastolica: 80,
        frecuenciaCardiaca: 76,
        temperatura: 36.8,
        critico: false,
        fueraDeRango: [],
        nota: 'Controles de signos vitales realizados con éxito.',
      });
      expect(published).toHaveLength(0);
    });

    it('marks a temperature of 39.8 °C as critical and publishes one alert', async () => {
      const { service, repository, published } = build();
      repository.createControl.mockResolvedValue(filasControl(39.8));

      const result = await service.registrarControl(dto(39.8), identity);

      expect(result.critico).toBe(true);
      expect(result.fueraDeRango).toContain('Temperatura');
      expect(result.nota).toContain('Temperatura');
      expect(published).toHaveLength(1);
      expect(published[0]).toMatchObject({
        type: INTEGRATION_EVENTS.VITAL_SIGN_ALERT,
        payload: { patientId: 'patient-1', tipo: 'TEMPERATURA', valor: 39.8, registeredBy: 'nurse-1' },
      });
    });

    it('rejects implausible values with 400 and stores nothing', async () => {
      const { service, repository } = build();
      await expect(service.registrarControl(dto(80), identity)).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.createControl).not.toHaveBeenCalled();
    });

    it('propagates 404 when the patient does not exist and stores nothing', async () => {
      const { service, repository } = build({ patientExists: false });
      await expect(service.registrarControl(dto(36.8), identity)).rejects.toBeInstanceOf(NotFoundException);
      expect(repository.createControl).not.toHaveBeenCalled();
    });

    it('publishes no alert when the repository rejects the control', async () => {
      const { service, repository, published } = build();
      repository.createControl.mockRejectedValue(new Error('db down'));

      await expect(service.registrarControl(dto(39.8), identity)).rejects.toThrow('db down');
      expect(published).toHaveLength(0);
    });

    it('lists controls grouped by controlId and drops incomplete groups', async () => {
      const { service, repository } = build();
      repository.listControles.mockResolvedValue([
        ...filasControl(36.5, 'control-a'),
        fila('TEMPERATURA', 37, 'control-incompleto'),
        ...filasControl(39.6, 'control-b'),
      ]);

      const result = await service.listarControles();

      expect(result.map((c) => c.id)).toEqual(['control-a', 'control-b']);
      expect(result[0]).toMatchObject({ critico: false, temperatura: 36.5 });
      expect(result[1]).toMatchObject({ critico: true, temperatura: 39.6 });
    });
  });
});
